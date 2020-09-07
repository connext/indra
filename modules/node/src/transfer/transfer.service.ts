import { Injectable } from "@nestjs/common";
import {
  Address,
  AppStates,
  Bytes32,
  CoinTransfer,
  ConditionalTransferAppNames,
  ConditionalTransferTypes,
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
  GenericConditionalTransferAppName,
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
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { DepositService } from "../deposit/deposit.service";
import { TIMEOUT_BUFFER } from "../constants";
import { Channel } from "../channel/channel.entity";
import { SwapRateService } from "../swapRate/swapRate.service";

import { TransferRepository } from "./transfer.repository";
import { ConfigService } from "../config/config.service";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

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
      throw new Error(`Can't get cancel action for unrecognized transfer type: ${c}`);
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
    private readonly appInstanceRepository: AppInstanceRepository,
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
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(
      _channel.multisigAddress,
    );
    this.log.info(
      `Start pruneExpiredApps for channel ${channel.multisigAddress} on chainId ${channel.chainId}`,
    );
    const current = await this.configService.getEthProvider(channel.chainId)!.getBlockNumber();
    const expiredApps = channel.appInstances.filter(
      (app) =>
        app.latestState && app.latestState.expiry && toBN(app.latestState.expiry).lte(current),
    );
    this.log.info(`Removing ${expiredApps.length} expired apps on chainId ${channel.chainId}`);
    for (const app of expiredApps) {
      try {
        // Uninstall all expired apps without taking action
        await this.cfCoreService.uninstallApp(app.identityHash, channel);
      } catch (e) {
        this.log.warn(`Failed to uninstall expired app ${app.identityHash}: ${e.message}`);
      }
    }
    this.log.info(
      `Finish pruneExpiredApps for channel ${channel.multisigAddress} on chainId ${channel.chainId}`,
    );
  }

  // NOTE: This function is called by `transferAppInstallFlow` and
  // should hard error if it cannot install the sender app *ONLY*
  // so it is properly rejected
  // Otherwise, it should error gracefully from the function, including
  // performing any relevant cleanup
  private async offlineTransferFlow(
    paymentId: string,
    senderProposal: AppInstance,
    proposeParams: MethodParams.ProposeInstall,
    from: string,
    transferType: ConditionalTransferTypes,
  ): Promise<void> {
    // Get the senders channel
    const senderChannel = await this.channelRepository.findByAppIdentityHashOrThrow(
      senderProposal.identityHash,
    );

    // Install the sender app
    this.log.info(
      `Installing sender app ${senderProposal.identityHash} in channel ${senderChannel.multisigAddress}`,
    );
    await this.cfCoreService.installApp(senderProposal.identityHash, senderChannel);
    this.log.info(
      `Sender app ${senderProposal.identityHash} in channel ${senderChannel.multisigAddress} installed`,
    );

    // If there is no specified recipient, return
    const recipient = proposeParams.meta.recipient;
    if (!recipient) {
      this.log.info(`No recipient specified for transfer, offline transfer flow complete`);
      return;
    }

    // Set the chainId + get channel
    const receiverChainId = proposeParams.meta.receiverChainId || senderChannel.chainId;
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierAndChain(
      recipient,
      receiverChainId,
    );
    if (!receiverChannel) {
      this.log.info(`No receiver channel found, waiting for them to create one.`);
      return;
    }

    // Propose receiver app
    let receiverProposeRes: (MethodResults.ProposeInstall & { appType: AppType }) | undefined;
    try {
      receiverProposeRes = (await Promise.race([
        this.proposeReceiverAppByPaymentId(
          from,
          senderChannel.chainId,
          recipient,
          receiverChainId,
          paymentId,
          proposeParams.initiatorDepositAssetId,
          proposeParams.initialState as AppStates[typeof transferType],
          proposeParams.meta,
          transferType,
          receiverChannel,
        ),
        delayAndThrow(
          CF_METHOD_TIMEOUT * 3,
          `Could not collateralize & propose receiver app within ${CF_METHOD_TIMEOUT * 3}ms`,
        ),
      ])) as any;
    } catch (e) {
      this.log.error(`Unable to propose receiver app: ${e.message}`);

      // TODO: reject if not timeout error.
      // NOTE: the `deposit` function will swallow errors related to the
      // protocol and return `Node failed to deposit`, so does propose
      // `proposeAndInstall`. Will require a deeper refactor of error
      // handling, which is out of scope of this PR

      // // IFF the receiver is offline, leave sender app installed
      // // Otherwise, uninstall sender app
      // if (e.message.includes(`IO_SEND_AND_WAIT timed out`) || e.message.includes(`Could not collateralize & propose receiver app within`)) {
      //   this.log.info(`Receiver was not online for transfer proposal`);
      //   return;
      // }

      // // Uninstall the sender app
      // this.log.warn(`Error was not timeout error, cancelling sender payment`);
      // await this.cfCoreService.uninstallApp(
      //   senderProposal.identityHash,
      //   senderChannel,
      //   getCancelAction(transferType),
      // );
      return;
    }

    if (
      !receiverProposeRes?.appIdentityHash ||
      receiverProposeRes.appType !== AppType.PROPOSAL
    ) {
      this.log.error(`Could not propose receiver app properly: ${stringify(receiverProposeRes)}`);
      // Clean up sender app
      this.log.warn(`Cancelling sender payment`);
      await this.cfCoreService.uninstallApp(
        senderProposal.identityHash,
        senderChannel,
        getCancelAction(transferType),
      );
      return;
    }

    // Try to install the receiver app, and reject the proposal if it fails
    this.log.info(
      `Installing receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress}`,
    );
    let receiverAppInstalled: undefined | AppInstance;
    try {
      await this.cfCoreService.installApp(receiverProposeRes.appIdentityHash, receiverChannel);
      this.log.info(
        `Receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress} installed`,
      );
      // Add the receiver app to the transfer
      receiverAppInstalled = await this.appInstanceRepository.findByIdentityHashOrThrow(
        receiverProposeRes!.appIdentityHash,
      );
    } catch (e) {
      const msg = `Error installing or saving receiver app to transfer: ${e.message}`;
      this.log.error(msg);
      if (receiverAppInstalled) {
        // must uninstall the receiver app if we couldn't add to our
        // database, and uninstall sender app
        // Clean up sender app
        this.log.warn(`Cancelling sender payment`);
        await this.cfCoreService.uninstallApp(
          senderProposal.identityHash,
          senderChannel,
          getCancelAction(transferType),
        );

        // Cancel receiver payment
        // Clean up sender app
        this.log.warn(`Cancelling receiver payment`);
        await this.cfCoreService.uninstallApp(
          receiverAppInstalled.identityHash,
          receiverChannel,
          getCancelAction(transferType),
        );
      } else {
        // Receiver app was never installed, reject proposal
        this.log.warn(`Rejecting receiver's proposal`);
        await this.cfCoreService.rejectInstallApp(
          receiverProposeRes.appIdentityHash,
          receiverChannel,
          msg,
        );
      }
    }
  }

  // NOTE: designed to be called from the proposal event handler to enforce
  // receivers are online if needed or that payment ids are unique, etc
  // NOTE: If this function errors, the sender proposal will be rejected!
  async transferAppInstallFlow(
    senderAppIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    senderChannel: Channel,
    transferType: ConditionalTransferTypes,
  ): Promise<void> {
    this.log.info(`Start transferAppInstallFlow for appIdentityHash ${senderAppIdentityHash}`);

    const paymentId = proposeInstallParams.meta.paymentId;
    const existing = await this.appInstanceRepository.findTransferAppByPaymentIdAndSender(
      paymentId,
      getSignerAddressFromPublicIdentifier(senderChannel.userIdentifier),
    );
    if (existing?.type !== AppType.PROPOSAL) {
      throw new Error(
        `Duplicate payment id ${paymentId} has already been used to send a transfer or sender app does not exist`,
      );
    }

    // Create the transfer with the sender app and the payment id
    await this.transferRepository.createTransfer(paymentId, existing);

    const requireOnline =
      RequireOnlineApps.includes(transferType) || proposeInstallParams.meta["requireOnline"];

    // If the app is allowed to be installed offline, use the offline
    // allowed flow
    if (!requireOnline) {
      await this.offlineTransferFlow(
        paymentId,
        existing, // sender proposal
        proposeInstallParams,
        from,
        transferType,
      );
      this.log.info(
        `TransferAppInstallFlow for offline payment complete. Sender app: ${senderAppIdentityHash}`,
      );
      return;
    }

    // The receiver *must* be online for this transfer to proceed.
    if (!proposeInstallParams.meta.recipient) {
      throw new Error(
        `No recipient specified in transfer meta: ${stringify(proposeInstallParams.meta)}`,
      );
    }

    // Set the chainId + get channel
    const receiverChainId = proposeInstallParams.meta.receiverChainId
      ? proposeInstallParams.meta.receiverChainId
      : senderChannel.chainId;
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierAndChainOrThrow(
      proposeInstallParams.meta.recipient,
      receiverChainId,
    );

    // Try to install receiver app
    this.log.info(`Attempting to propose receiver app to chainId ${receiverChainId}`);
    // If the receiver app fails to install here, the sender application
    // should be rejected.
    const receiverProposeRes = (await Promise.race([
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

    // Verify proposal
    if (!receiverProposeRes?.appIdentityHash || receiverProposeRes?.appType !== AppType.PROPOSAL) {
      throw new Error("Unable to properly propose receiver online transfer app");
    }

    // Install the sender app before installing the receiver app, so the payment
    // recipient does not get a free option
    // NOTE: this should *NOT* error because it will trigger a `reject` on an
    // installed app
    try {
      this.log.info(
        `Installing sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress}`,
      );

      await this.cfCoreService.installApp(senderAppIdentityHash, senderChannel);
      this.log.info(
        `Sender app ${senderAppIdentityHash} in channel ${senderChannel.multisigAddress} installed`,
      );
    } catch (e) {
      this.log.error(`Error installing sender app: ${e.message}`);
      // Reject the receiver proposal
      this.log.warn(`Rejecting receiver payment`);
      await this.cfCoreService.rejectInstallApp(
        receiverProposeRes.appIdentityHash,
        receiverChannel,
        `Receiver offline for transfer`,
      );

      // Uninstall the sender application
      // cancel sender: https://github.com/ConnextProject/indra/issues/942
      this.log.warn(`Canceling sender payment`);
      await this.cfCoreService.uninstallApp(
        senderAppIdentityHash,
        senderChannel,
        getCancelAction(transferType),
      );
    }

    // Install receiver application
    this.log.info(
      `Installing receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress}`,
    );
    await this.cfCoreService.installApp(receiverProposeRes.appIdentityHash, receiverChannel);
    this.log.info(
      `Receiver app ${receiverProposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress} installed`,
    );
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

    const res = await this.cfCoreService.proposeInstallApp(
      {
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
      },
      receiverChannel,
    );
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
      await this.cfCoreService.installApp(proposeRes.appIdentityHash, receiverChannel);
      this.log.info(
        `Receiver app ${proposeRes.appIdentityHash} in channel ${receiverChannel.multisigAddress} installed`,
      );
      // Add the receiver app to the transfer
      const receiverApp = await this.appInstanceRepository.findByIdentityHashOrThrow(
        proposeRes.appIdentityHash,
      );
      await this.transferRepository.addTransferReceiver(paymentId, receiverApp);
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
    const app = await this.appInstanceRepository.findTransferAppByPaymentIdAndReceiver<T>(
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
    const app = await this.appInstanceRepository.findTransferAppByPaymentIdAndSender<T>(
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
    const senderTransferApps = await this.appInstanceRepository.findTransferAppsByChannelUserIdentifierAndReceiver(
      senderIdentifier,
      this.cfCoreService.cfCore.signerAddress,
    );

    for (const senderApp of senderTransferApps) {
      try {
        // eslint-disable-next-line max-len
        const correspondingReceiverApp = await this.appInstanceRepository.findTransferAppByPaymentIdAndSender(
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
            )} correspondingReceiverApp: ${stringify(
              correspondingReceiverApp.latestState,
              true,
              0,
            )}`,
          );
          // need to take action before uninstalling
          if (!correspondingReceiverApp.transfer?.action) {
            throw new Error(
              `Receiver app has no transfer action and states are different, refusing to uninstall`,
            );
          }
          await this.cfCoreService.uninstallApp(
            senderApp.identityHash,
            senderApp.channel,
            correspondingReceiverApp.transfer.action,
          );
        } else {
          this.log.info(`Uninstalling sender app for paymentId ${senderApp.meta.paymentId}`);
          await this.cfCoreService.uninstallApp(senderApp.identityHash, senderApp.channel);
        }
        this.log.info(
          `Finished uninstalling sender app with paymentId ${senderApp.meta.paymentId}`,
        );
      } catch (e) {
        this.log.error(`Error unlocking sender app: ${e.message}`);
      }
    }

    this.log.info(`unlockSenderApps: ${senderIdentifier} complete`);
  }
}
