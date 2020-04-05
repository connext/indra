import {
  bigNumberifyJson,
  DepositConfirmationMessage,
  DepositFailedMessage,
  EventNames,
  ResolveSignedTransferResponse,
  SignedTransferStatus,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  Bytes32Hash,
  Xpub,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { xkeyKthAddress } from "../util";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { SignedTransferRepository } from "./signedTransfer.repository";

const appStatusesToSignedTransferStatus = (
  senderApp: AppInstance<SimpleSignedTransferAppState>,
  receiverApp?: AppInstance<SimpleSignedTransferAppState>,
): SignedTransferStatus | undefined => {
  if (!senderApp) {
    return undefined;
  }
  // pending iff no receiver app + not expired
  if (!receiverApp) {
    return SignedTransferStatus.PENDING;
  } else if (senderApp.latestState.finalized || receiverApp.latestState.finalized) {
    // iff sender uninstalled, payment is unlocked
    return SignedTransferStatus.COMPLETED;
  } else if (senderApp.type === AppType.REJECTED || receiverApp.type === AppType.REJECTED) {
    return SignedTransferStatus.FAILED;
  } else {
    throw new Error(`Cound not determine hash lock transfer status`);
  }
};

export const normalizeSignedTransferAppState = (
  app: AppInstance,
): AppInstance<SimpleSignedTransferAppState> | undefined => {
  return (
    app && {
      ...app,
      latestState: bigNumberifyJson(app.latestState) as SimpleSignedTransferAppState,
    }
  );
};

@Injectable()
export class SignedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly signedTransferRepository: SignedTransferRepository,
  ) {
    this.log.setContext("SignedTransferService");
  }

  async installSignedTransferReceiverApp(
    userPublicIdentifier: Xpub,
    paymentId: Bytes32Hash,
  ): Promise<ResolveSignedTransferResponse> {
    this.log.debug(`resolveLinkedTransfer(${userPublicIdentifier}, ${paymentId})`);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );

    // TODO: could there be more than 1? how to handle that case?
    let [senderAppBadType] = await this.signedTransferRepository.findSignedTransferAppsByPaymentId(
      paymentId,
    );
    if (!senderAppBadType) {
      throw new Error(`No sender app installed for paymentId: ${paymentId}`);
    }

    const senderChannel = await this.channelRepository.findByMultisigAddressOrThrow(
      senderAppBadType.channel.multisigAddress,
    );
    const senderApp = normalizeSignedTransferAppState(senderAppBadType);

    const assetId = senderApp.outcomeInterpreterParameters.tokenAddress;

    // sender amount
    const amount = senderApp.latestState.coinTransfers[0].amount;

    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPublicIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (freeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      // TODO: expose remove listener
      await new Promise(async (resolve, reject) => {
        this.cfCoreService.cfCore.on(
          EventNames.DEPOSIT_CONFIRMED_EVENT,
          async (msg: DepositConfirmationMessage) => {
            if (
              msg.from === this.cfCoreService.cfCore.publicIdentifier &&
              msg.data.multisigAddress === channel.multisigAddress
            ) {
              resolve();
              return;
            }
            // do not reject promise here, since theres a chance the event is
            // emitted for another user depositing into their channel
            this.log.debug(
              `Deposit event did not match desired: ${
                this.cfCoreService.cfCore.publicIdentifier
              }, ${channel.multisigAddress}: ${JSON.stringify(msg)} `,
            );
          },
        );
        this.cfCoreService.cfCore.on(
          EventNames.DEPOSIT_FAILED_EVENT,
          (msg: DepositFailedMessage) => {
            return reject(JSON.stringify(msg, null, 2));
          },
        );
        try {
          await this.channelService.rebalance(
            userPublicIdentifier,
            assetId,
            RebalanceType.COLLATERALIZE,
            amount,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
    }

    const initialState: SimpleSignedTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xkeyKthAddress(userPublicIdentifier),
        },
      ],
      paymentId,
      signer: senderApp.latestState.signer,
      finalized: false,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      SimpleSignedTransferAppName,
      senderApp.meta,
    );


    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appId: receiverAppInstallRes.appInstanceId,
      sender: senderChannel.userPublicIdentifier,
      meta: senderApp["meta"] || {},
      amount,
      assetId,
    };
  }

  async findSenderAndReceiverAppsWithStatus(
    paymentId: string,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    // node receives from sender
    const senderApp = await this.findSenderAppByPaymentId(paymentId);
    // node is sender
    const receiverApp = await this.findReceiverAppByPaymentId(paymentId);
    const status = appStatusesToSignedTransferStatus(senderApp, receiverApp);
    return { senderApp, receiverApp, status };
  }

  async findSenderAppByPaymentId(paymentId: string): Promise<AppInstance> {
    // node receives from sender
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    return normalizeSignedTransferAppState(app);
  }

  async findReceiverAppByPaymentId(paymentId: string): Promise<AppInstance> {
    // node sends to receiver
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    return normalizeSignedTransferAppState(app);
  }
}
