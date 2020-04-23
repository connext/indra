import { SIGNED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  Bytes32,
  NodeResponses,
  SignedTransferStatus,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  Address,
} from "@connext/types";
import { bigNumberifyJson, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { SignedTransferRepository } from "./signedTransfer.repository";

const appStatusesToSignedTransferStatus = (
  senderApp: AppInstance<typeof SimpleSignedTransferAppName>,
  receiverApp?: AppInstance<typeof SimpleSignedTransferAppName>,
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
): AppInstance<typeof SimpleSignedTransferAppName> | undefined => {
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
    userIdentifier: Address,
    paymentId: Bytes32,
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    this.log.info(
      `installSignedTransferReceiverApp for ${userIdentifier} paymentId ${paymentId} started`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userIdentifier);

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

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userIdentifier,
      channel.multisigAddress,
      assetId,
    );
    if (freeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      const depositReceipt = await this.channelService.rebalance(
        userIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
      if (!depositReceipt) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve signed transfer app for receiver: ${userIdentifier}`,
        );
      }
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(userIdentifier, assetId, RebalanceType.COLLATERALIZE, amount);
    }

    const initialState: SimpleSignedTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: getSignerAddressFromPublicIdentifier(userIdentifier),
        },
      ],
      paymentId,
      signer: senderApp.latestState.signer,
      finalized: false,
    };

    const meta = { ...senderApp.meta, sender: senderChannel.userIdentifier };
    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      SimpleSignedTransferAppName,
      meta,
      SIGNED_TRANSFER_STATE_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const result: NodeResponses.ResolveSignedTransfer = {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
      sender: senderChannel.userIdentifier,
      meta,
      amount,
      assetId,
    };
    this.log.info(
      `installSignedTransferReceiverApp for ${userIdentifier} paymentId ${paymentId} complete: ${JSON.stringify(
        result,
      )}`,
    );
    return result;
  }

  async findSenderAndReceiverAppsWithStatus(
    paymentId: string,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${paymentId} started`);
    const senderApp = await this.findSenderAppByPaymentId(paymentId);
    const receiverApp = await this.findReceiverAppByPaymentId(paymentId);
    const status = appStatusesToSignedTransferStatus(senderApp, receiverApp);
    const result = { senderApp, receiverApp, status };
    this.log.info(
      `findSenderAndReceiverAppsWithStatus ${paymentId} complete: ${JSON.stringify(result)}`,
    );
    return result;
  }

  async findSenderAppByPaymentId(paymentId: string): Promise<AppInstance> {
    this.log.info(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    const result = normalizeSignedTransferAppState(app);
    this.log.info(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }

  async findReceiverAppByPaymentId(paymentId: string): Promise<AppInstance> {
    this.log.info(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    const result = normalizeSignedTransferAppState(app);
    this.log.info(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }
}
