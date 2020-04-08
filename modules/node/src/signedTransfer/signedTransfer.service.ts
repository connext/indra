import { SIGNED_TRANSFER_STATE_TIMEOUT } from "@connext/apps";
import {
  bigNumberifyJson,
  Bytes32,
  NodeResponses,
  SignedTransferStatus,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
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
    userPublicIdentifier: string,
    paymentId: Bytes32,
  ): Promise<NodeResponses.ResolveSignedTransfer> {
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
      const depositReceipt = await this.channelService.rebalance(
        userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amount,
      );
      if (!depositReceipt) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve signed transfer app for receiver: ${userPublicIdentifier}`,
        );
      }
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
      SIGNED_TRANSFER_STATE_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
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
