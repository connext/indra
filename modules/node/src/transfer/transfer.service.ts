import { Injectable } from "@nestjs/common";
import {
  Address,
  AppStates,
  Bytes32,
  CoinTransfer,
  ConditionalTransferAppNames,
  ConditionalTransferTypes,
  GenericConditionalTransferAppName,
  RequireOnlineApps,
  GraphBatchedTransferAppAction,
  GraphBatchedTransferAppState,
  GraphSignedTransferAppAction,
  HashLockTransferAppAction,
  HashLockTransferAppState,
  MethodParams,
  MethodResults,
  PublicResults,
  SimpleLinkedTransferAppAction,
  SimpleSignedTransferAppAction,
  SupportedApplicationNames,
  CF_METHOD_TIMEOUT,
} from "@connext/types";
import {
  stringify,
  getSignerAddressFromPublicIdentifier,
  calculateExchangeWad,
  toBN,
  delayAndThrow,
} from "@connext/utils";
import { MINIMUM_APP_TIMEOUT } from "@connext/apps";
import { Interval } from "@nestjs/schedule";
import { constants, utils } from "ethers";
import { isEqual } from "lodash";

import { LoggerService } from "../logger/logger.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { DepositService } from "../deposit/deposit.service";
import { TIMEOUT_BUFFER } from "../constants";
import { Channel } from "../channel/channel.entity";
import { SwapRateService } from "../swapRate/swapRate.service";

import { TransferRepository } from "./transfer.repository";
import { ConfigService } from "../config/config.service";
import { CFCoreStore } from "../cfCore/cfCore.store";

const { Zero, HashZero } = constants;
const { parseUnits } = utils;

export const getCancelAction = (
  transferType: ConditionalTransferTypes,
):
  | HashLockTransferAppAction
  | SimpleSignedTransferAppAction
  | GraphSignedTransferAppAction
  | GraphBatchedTransferAppAction
  | SimpleLinkedTransferAppAction => {
  let action:
    | HashLockTransferAppAction
    | SimpleSignedTransferAppAction
    | GraphSignedTransferAppAction
    | GraphBatchedTransferAppAction
    | SimpleLinkedTransferAppAction
    | undefined;
  switch (transferType) {
    case ConditionalTransferTypes.OnlineTransfer:
    case ConditionalTransferTypes.LinkedTransfer:
    case ConditionalTransferTypes.HashLockTransfer: {
      action = { preImage: HashZero } as HashLockTransferAppAction;
      break;
    }
    case ConditionalTransferTypes.GraphTransfer: {
      action = { responseCID: HashZero, signature: "0x" } as GraphSignedTransferAppAction;
      break;
    }
    case ConditionalTransferTypes.GraphBatchedTransfer: {
      action = {
        responseCID: HashZero,
        requestCID: HashZero,
        consumerSignature: "0x",
        attestationSignature: "0x",
      } as GraphBatchedTransferAppAction;
      break;
    }
    case ConditionalTransferTypes.SignedTransfer: {
      action = { data: HashZero, signature: "0x" } as SimpleSignedTransferAppAction;
      break;
    }
    default: {
      const c: never = transferType;
    }
  }
  if (!action) {
    throw new Error(`No cancel action defined`);
  }
  return action;
};

@Injectable()
export class TransferService {
  constructor(
    private readonly log: LoggerService,
    private readonly cfCoreService: CFCoreService,
    private readonly cfCoreStore: CFCoreStore,
    private readonly channelService: ChannelService,
    private readonly depositService: DepositService,
    private readonly swapRateService: SwapRateService,
    private readonly configService: ConfigService,
    private readonly transferRepository: TransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("TransferService");
  }

  // TODO: make this interval configurable
  @Interval(3600_000)
  async pruneChannels() {
    const channels = await this.channelRepository.findAll();
    for (const channel of channels) {
      await this.pruneExpiredApps(channel);
    }
  }

  async pruneExpiredApps(_channel: Channel): Promise<void> {
    const channel = await this.cfCoreStore.getStateChannel(_channel.multisigAddress);
    if (!channel) {
      throw new Error(`Could not get state channel for ${_channel.multisigAddress}`);
    }
    this.log.info(
      `Start pruneExpiredApps for channel ${channel.multisigAddress} on chainId ${channel.chainId}`,
    );
    const current = await this.configService.getEthProvider(channel.chainId)!.getBlockNumber();
    const expiredApps = channel.appInstances.filter(
      ([, app]) =>
        app.latestState && app.latestState.expiry && toBN(app.latestState.expiry).lte(current),
    );
    this.log.info(`Removing ${expiredApps.length} expired apps on chainId ${channel.chainId}`);
    for (const [, app] of expiredApps) {
      try {
        // Uninstall all expired apps without taking action
        await this.cfCoreService.uninstallApp(app.identityHash, channel.multisigAddress);
      } catch (e) {
        this.log.warn(`Failed to uninstall expired app ${app.identityHash}: ${e.message}`);
      }
    }
    this.log.info(
      `Finish pruneExpiredApps for channel ${channel.multisigAddress} on chainId ${channel.chainId}`,
    );
  }

  // NOTE: designed to be called from the proposal event handler to enforce
  // receivers are online if needed or that payment ids are unique, etc
  async transferAppInstallFlow(
    senderAppIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    senderChannel: Channel,
    transferType: ConditionalTransferTypes,
  ): Promise<void> {
    this.log.info(`Start transferAppInstallFlow for appIdentityHash ${senderAppIdentityHash}`);

    const paymentId = proposeInstallParams.meta.paymentId;
    const existing = await this.transferRepository.findTransferAppByPaymentIdAndSender(
      paymentId,
      getSignerAddressFromPublicIdentifier(senderChannel.userIdentifier),
    );
    if (existing?.type !== AppType.PROPOSAL) {
      throw new Error(
        `Duplicate payment id ${paymentId} has already been used to send a transfer or sender app does not exist`,
      );
    }

    const requireOnline =
      RequireOnlineApps.includes(transferType) || proposeInstallParams.meta["requireOnline"];

    // ALLOW OFFLINE SENDER INSTALL
    if (!requireOnline) {
      this.log.info(
        `Installing sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress}`,
      );
      // if errors, it will reject the sender's proposal in the calling function
      await this.cfCoreService.installApp(senderAppIdentityHash, senderChannel.multisigAddress);
      this.log.info(
        `Sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress} installed`,
      );
    }

    if (!proposeInstallParams.meta.recipient) {
      return;
    }

    // RECEIVER PROPOSAL
    let receiverProposeRes: (MethodResults.ProposeInstall & { appType: AppType }) | undefined;
    const receiverChainId = proposeInstallParams.meta.receiverChainId
      ? proposeInstallParams.meta.receiverChainId
      : senderChannel.chainId;
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      proposeInstallParams.meta.recipient,
      receiverChainId,
    );

    this.log.info(`Installing receiver app to chainId ${receiverChainId}`);

    try {
      receiverProposeRes = (await Promise.race([
        this.proposeReceiverAppByPaymentId(
          from,
          senderChannel.chainId,
          proposeInstallParams.meta.recipient,
          receiverChainId,
          paymentId,
          proposeInstallParams.initiatorDepositAssetId,
          proposeInstallParams.initialState as AppStates[typeof transferType],
          proposeInstallParams.meta,
          transferType,
          receiverChannel,
        ),
        // the sender client will time out after waiting for CF_METHOD_TIMEOUT * 3. do not continue installing sender app.
        // collateralization may still complete even after this error occurs.
        delayAndThrow(
          CF_METHOD_TIMEOUT * 3,
          `Could not collateralize & propose receiver app within ${CF_METHOD_TIMEOUT * 3}ms`,
        ),
      ])) as any;
    } catch (e) {
      this.log.error(`Error proposing receiver app: ${e.message || e}`);
      if (requireOnline) {
        if (receiverProposeRes?.appIdentityHash) {
          await this.cfCoreService.rejectInstallApp(
            receiverProposeRes.appIdentityHash,
            receiverChannel.multisigAddress,
            `Receiver offline for transfer`,
          );
        }
      }
      this.log.warn(
        `TransferAppInstallFlow for appIdentityHash ${senderAppIdentityHash} complete, receiver app not installed`,
      );
      return;
    }

    // REQUIRE ONLINE SENDER INSTALL
    if (requireOnline) {
      this.log.info(
        `Installing sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress}`,
      );
      // this should throw so it doesn't install receiver app in case of error
      // will reject in caller function
      await this.cfCoreService.installApp(senderAppIdentityHash, senderChannel.multisigAddress);
      this.log.info(
        `Sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress} installed`,
      );
    }

    // RECEIVER INSTALL
    try {
      if (receiverProposeRes?.appIdentityHash && receiverProposeRes?.appType === AppType.PROPOSAL) {
        this.log.info(
          `Installing receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress}`,
        );
        await this.cfCoreService.installApp(
          receiverProposeRes.appIdentityHash,
          receiverChannel.multisigAddress,
        );
        this.log.info(
          `Receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress} installed`,
        );
      }
    } catch (e) {
      this.log.error(`Error installing receiver app: ${e.message || e}`);
      if (requireOnline) {
        // cancel sender: https://github.com/ConnextProject/indra/issues/942
        this.log.warn(`Canceling sender payment`);
        await this.cfCoreService.uninstallApp(
          senderAppIdentityHash,
          senderChannel.multisigAddress,
          getCancelAction(transferType),
        );
        this.log.warn(`Sender payment canceled`);
        if (receiverProposeRes?.appIdentityHash) {
          await this.cfCoreService.rejectInstallApp(
            receiverProposeRes.appIdentityHash,
            receiverChannel.multisigAddress,
            `Receiver offline for transfer`,
          );
        }
      }
    }
    this.log.info(`TransferAppInstallFlow for appIdentityHash ${senderAppIdentityHash} complete`);
  }

  async proposeReceiverAppByPaymentId(
    senderIdentifier: string,
    senderChainId: number,
    receiverIdentifier: string,
    receiverChainId: number,
    paymentId: Bytes32,
    senderAssetId: Address,
    senderAppState: AppStates[ConditionalTransferAppNames],
    meta: any = {},
    transferType: ConditionalTransferAppNames,
    receiverChannel?: Channel,
  ): Promise<MethodResults.ProposeInstall & { appType: AppType }> {
    this.log.info(
      `installReceiverAppByPaymentId for ${receiverIdentifier} paymentId ${paymentId} started`,
    );

    if (!receiverChannel) {
      receiverChannel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
        receiverIdentifier,
        receiverChainId,
      );
    }

    const senderAmount = senderAppState.coinTransfers[0].amount;

    // inflight swap
    const receiverAssetId = meta.receiverAssetId ? meta.receiverAssetId : senderAssetId;
    let receiverAmount = senderAmount;
    let swapRate = "1";
    if (receiverAssetId !== senderAssetId || senderChainId !== receiverChainId) {
      this.log.warn(
        `Detected an inflight swap from ${senderAssetId} on ${senderChainId} to ${receiverAssetId} on ${receiverChainId}!`,
      );
      swapRate = await this.swapRateService.getOrFetchRate(
        senderAssetId,
        receiverAssetId,
        senderChainId,
        receiverChainId,
      );
      this.log.warn(`Using swap rate ${swapRate} for inflight swap`);
      const senderDecimals = 18;
      const receiverDecimals = 18;
      receiverAmount = calculateExchangeWad(
        senderAmount,
        senderDecimals,
        swapRate,
        receiverDecimals,
      );
    }

    const existing = await this.findReceiverAppByPaymentId(paymentId);
    if (existing && (existing.type === AppType.INSTANCE || existing.type === AppType.PROPOSAL)) {
      const result: PublicResults.ResolveCondition = {
        appIdentityHash: existing.identityHash,
        sender: senderIdentifier,
        paymentId,
        meta,
        amount: receiverAmount,
        assetId: receiverAssetId,
      };
      this.log.warn(
        `Found existing transfer app, returning: ${stringify({
          ...result,
          appType: existing.type,
        })}`,
      );
      return { ...result, appType: existing.type };
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      receiverIdentifier,
      receiverChannel.multisigAddress,
      receiverAssetId,
    );

    if (freeBal[freeBalanceAddr].lt(receiverAmount)) {
      // request collateral and wait for deposit to come through
      this.log.warn(
        `Collateralizing ${receiverIdentifier} before proceeding with transfer payment`,
      );
      const deposit = await this.channelService.getCollateralAmountToCoverPaymentAndRebalance(
        receiverIdentifier,
        receiverChainId,
        receiverAssetId,
        receiverAmount,
        freeBal[freeBalanceAddr],
      );
      // request collateral and wait for deposit to come through\
      let depositError: Error | undefined = undefined;
      try {
        const depositResponse = await this.depositService.deposit(
          receiverChannel,
          deposit,
          receiverAssetId,
        );
        if (!depositResponse) {
          throw new Error(`Node failed to install deposit app`);
        }
        this.log.info(`Installed deposit app in receiver channel, waiting for completion`);
        await depositResponse.completed();
      } catch (e) {
        depositError = e;
      }
      if (depositError) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve transfer for receiver: ${receiverIdentifier}. ${depositError.message}`,
        );
      }
    }

    const receiverCoinTransfers: CoinTransfer[] = [
      {
        amount: receiverAmount,
        to: freeBalanceAddr,
      },
      {
        amount: Zero,
        to: getSignerAddressFromPublicIdentifier(receiverIdentifier),
      },
    ];

    const initialState: AppStates[typeof transferType] = {
      ...senderAppState,
      coinTransfers: receiverCoinTransfers,
    };

    // special case for expiry in initial state, receiver app must always expire first
    if ((initialState as HashLockTransferAppState).expiry) {
      // eslint-disable-next-line max-len
      (initialState as HashLockTransferAppState).expiry = (initialState as HashLockTransferAppState).expiry.sub(
        TIMEOUT_BUFFER,
      );
    }

    if ((initialState as GraphBatchedTransferAppState).swapRate) {
      (initialState as GraphBatchedTransferAppState).swapRate = parseUnits(swapRate, 18);
    }

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = this.cfCoreService.getAppInfoByNameAndChain(
      transferType as SupportedApplicationNames,
      receiverChainId,
    );

    const res = await this.cfCoreService.proposeInstallApp({
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: receiverAmount,
      initiatorDepositAssetId: receiverAssetId,
      meta,
      multisigAddress: receiverChannel.multisigAddress,
      outcomeType,
      responderIdentifier: receiverIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: receiverAssetId, // receiverAssetId is same because swap happens between sender and receiver apps, not within the app
      defaultTimeout: MINIMUM_APP_TIMEOUT,
      stateTimeout: Zero,
    });
    return { ...res, appType: AppType.PROPOSAL };
  }

  async resolveByPaymentId(
    receiverIdentifier: string,
    receiverChainId: number,
    paymentId: string,
    transferType: ConditionalTransferAppNames,
  ): Promise<PublicResults.ResolveCondition> {
    const senderApp = await this.findSenderAppByPaymentId(paymentId);
    if (!senderApp || senderApp.type !== AppType.INSTANCE) {
      throw new Error(`Sender app is not installed for paymentId ${paymentId}`);
    }

    // this should never happen, maybe remove
    if (senderApp.latestState.preImage && senderApp.latestState.preImage !== HashZero) {
      throw new Error(`Sender app has action, refusing to redeem`);
    }

    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      receiverIdentifier,
      receiverChainId,
    );

    const proposeRes = await this.proposeReceiverAppByPaymentId(
      senderApp.initiatorIdentifier,
      senderApp.channel.chainId,
      receiverIdentifier,
      receiverChainId,
      paymentId,
      senderApp.initiatorDepositAssetId,
      senderApp.latestState,
      senderApp.meta,
      transferType,
      receiverChannel,
    );

    if (proposeRes?.appIdentityHash && proposeRes?.appType === AppType.PROPOSAL) {
      this.log.info(
        `Installing receiver app ${proposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress}`,
      );
      await this.cfCoreService.installApp(
        proposeRes.appIdentityHash,
        receiverChannel.multisigAddress,
      );
      this.log.info(
        `Receiver app ${proposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress} installed`,
      );
    }

    return {
      amount: senderApp.latestState.coinTransfers[0].amount,
      appIdentityHash: proposeRes.appIdentityHash,
      assetId: senderApp.meta.receiverAssetId
        ? senderApp.meta.receiverAssetId
        : senderApp.initiatorDepositAssetId,
      paymentId,
      sender: senderApp.channel.userIdentifier,
      meta: senderApp.meta,
    };
  }

  async findSenderAppByPaymentId<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string): Promise<AppInstance<T> | undefined> {
    this.log.debug(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.transferRepository.findTransferAppByPaymentIdAndReceiver<T>(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.debug(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }

  async findReceiverAppByPaymentId<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string): Promise<AppInstance<T> | undefined> {
    this.log.debug(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.transferRepository.findTransferAppByPaymentIdAndSender<T>(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.debug(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }

  // unlockable transfer:
  // sender app is installed with node as recipient
  // receiver app with same paymentId is uninstalled
  // latest state on receiver app is different than sender app
  //
  // eg:
  // sender installs app, goes offline
  // receiver redeems, app is installed and uninstalled
  // sender comes back online, node can unlock transfer
  async unlockSenderApps(senderIdentifier: string): Promise<void> {
    this.log.info(`unlockSenderApps: ${senderIdentifier}`);
    // eslint-disable-next-line max-len
    const senderTransferApps = await this.transferRepository.findTransferAppsByChannelUserIdentifierAndReceiver(
      senderIdentifier,
      this.cfCoreService.cfCore.signerAddress,
    );

    for (const senderApp of senderTransferApps) {
      // eslint-disable-next-line max-len
      const correspondingReceiverApp = await this.transferRepository.findTransferAppByPaymentIdAndSender(
        senderApp.meta.paymentId,
        this.cfCoreService.cfCore.signerAddress,
      );

      if (!correspondingReceiverApp || correspondingReceiverApp.type !== AppType.UNINSTALLED) {
        continue;
      }

      this.log.info(
        `Found uninstalled corresponding receiver app for transfer app with paymentId: ${senderApp.meta.paymentId}`,
      );
      if (!isEqual(senderApp.latestState, correspondingReceiverApp.latestState)) {
        this.log.info(
          `Sender app latest state is not equal to receiver app, taking action and uninstalling. senderApp: ${stringify(
            senderApp.latestState,
            true,
            0,
          )} correspondingReceiverApp: ${stringify(correspondingReceiverApp.latestState, true, 0)}`,
        );
        // need to take action before uninstalling
        await this.cfCoreService.uninstallApp(
          senderApp.identityHash,
          senderApp.channel.multisigAddress,
          correspondingReceiverApp.latestAction,
        );
      } else {
        this.log.info(`Uninstalling sender app for paymentId ${senderApp.meta.paymentId}`);
        await this.cfCoreService.uninstallApp(
          senderApp.identityHash,
          senderApp.channel.multisigAddress,
        );
      }
      this.log.info(`Finished uninstalling sender app with paymentId ${senderApp.meta.paymentId}`);
    }

    this.log.info(`unlockSenderApps: ${senderIdentifier} complete`);
  }
}
