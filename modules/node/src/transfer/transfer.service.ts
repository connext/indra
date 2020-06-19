import { Injectable } from "@nestjs/common";
import {
  Address,
  Bytes32,
  ConditionalTransferAppNames,
  AppStates,
  PublicResults,
  HashLockTransferAppState,
  CoinTransfer,
  GenericConditionalTransferAppName,
  MethodParams,
  getTransferTypeFromAppName,
  SupportedApplicationNames,
} from "@connext/types";
import { stringify, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { TRANSFER_TIMEOUT } from "@connext/apps";
import { constants } from "ethers";

import { LoggerService } from "../logger/logger.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { DepositService } from "../deposit/deposit.service";
import { TIMEOUT_BUFFER } from "../constants";
import { Channel } from "../channel/channel.entity";

import { TransferRepository } from "./transfer.repository";

const { Zero, HashZero } = constants;

@Injectable()
export class TransferService {
  constructor(
    private readonly log: LoggerService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly depositService: DepositService,
    private readonly transferRepository: TransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("TransferService");
  }

  // NOTE: designed to be called from the proposal event handler to enforce
  // receivers are online if needed
  async transferAppInstallFlow(
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    installerChannel: Channel,
    transferType: ConditionalTransferAppNames,
  ): Promise<void> {
    this.log.info(`Start transferAppInstallFlow for appIdentityHash ${appIdentityHash}`);

    const paymentId = proposeInstallParams.meta["paymentId"];
    const allowed = getTransferTypeFromAppName(transferType as SupportedApplicationNames);
    // in the allow offline case, we want both receiver and sender apps to install in parallel
    // if allow offline, resolve after sender app install
    // if not, will be installed in middleware
    if (allowed === "AllowOffline") {
      this.log.info(
        `Installing sender app ${appIdentityHash} in channel ${installerChannel.multisigAddress}`,
      );
      await this.cfCoreService.installApp(appIdentityHash, installerChannel.multisigAddress);
      this.log.info(
        `Sender app ${appIdentityHash} in channel ${installerChannel.multisigAddress} installed`,
      );
    }

    // install for receiver or error
    // https://github.com/ConnextProject/indra/issues/942
    if (proposeInstallParams.meta.recipient) {
      const receiverInstallPromise = this.installReceiverAppByPaymentId(
        from,
        proposeInstallParams.meta.recipient,
        paymentId,
        proposeInstallParams.initiatorDepositAssetId,
        proposeInstallParams.initialState as AppStates[typeof transferType],
        proposeInstallParams.meta,
        transferType,
      )
        .then((receiverInstall) => {
          this.log.info(`Installed receiver app ${receiverInstall.appIdentityHash}`);
        })
        .catch((e) => {
          this.log.error(`Error installing receiver app: ${e.message || e}`);
          if (allowed === "RequireOnline") {
            throw e;
          }
        });
      if (allowed === "RequireOnline") {
        await receiverInstallPromise;
      }
      this.log.info(`TransferAppInstallFlow for appIdentityHash ${appIdentityHash} complete`);
    }
  }

  async installReceiverAppByPaymentId(
    senderIdentifier: string,
    receiverIdentifier: Address,
    paymentId: Bytes32,
    assetId: Address,
    senderAppState: AppStates[ConditionalTransferAppNames],
    meta: any = {},
    transferType: ConditionalTransferAppNames,
  ): Promise<PublicResults.ResolveCondition> {
    this.log.info(
      `installReceiverAppByPaymentId for ${receiverIdentifier} paymentId ${paymentId} started`,
    );
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      receiverIdentifier,
    );

    // sender amount
    const amount = senderAppState.coinTransfers[0].amount;

    const existing = await this.findReceiverAppByPaymentId(paymentId);
    if (existing && (existing.type === AppType.INSTANCE || existing.type === AppType.PROPOSAL)) {
      const result: PublicResults.ResolveCondition = {
        appIdentityHash: existing.identityHash,
        sender: senderIdentifier,
        paymentId,
        meta,
        amount,
        assetId,
      };
      this.log.warn(`Found existing transfer app, returning: ${stringify(result)}`);
      return result;
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      receiverIdentifier,
      receiverChannel.multisigAddress,
      assetId,
    );

    if (freeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      this.log.warn(
        `Collateralizing ${receiverIdentifier} before proceeding with transfer payment`,
      );
      const deposit = await this.channelService.getCollateralAmountToCoverPaymentAndRebalance(
        receiverIdentifier,
        assetId,
        amount,
        freeBal[freeBalanceAddr],
      );
      // request collateral and wait for deposit to come through
      const depositReceipt = await this.depositService.deposit(receiverChannel, deposit, assetId);
      if (!depositReceipt) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve transfer for receiver: ${receiverIdentifier}`,
        );
      }
    }

    const receiverCoinTransfers: CoinTransfer[] = [
      {
        amount,
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
      (initialState as HashLockTransferAppState).expiry = (initialState as HashLockTransferAppState).expiry.sub(
        TIMEOUT_BUFFER,
      );
    }

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      receiverChannel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      this.cfCoreService.getAppInfoByName(transferType as SupportedApplicationNames),
      meta,
      TRANSFER_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const result: PublicResults.ResolveCondition = {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
      paymentId,
      sender: senderIdentifier,
      meta,
      amount,
      assetId,
    };

    this.log.info(
      `installReceiverAppByPaymentId for ${receiverIdentifier} paymentId ${paymentId} complete: ${JSON.stringify(
        result,
      )}`,
    );
    return result;
  }

  async resolveByPaymentId(
    receiverIdentifier: string,
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

    return this.installReceiverAppByPaymentId(
      senderApp.initiatorIdentifier,
      receiverIdentifier,
      paymentId,
      senderApp.initiatorDepositAssetId,
      senderApp.latestState,
      senderApp.meta,
      transferType,
    );
  }

  async findSenderAppByPaymentId<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string): Promise<AppInstance<T>> {
    this.log.info(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.transferRepository.findTransferAppByPaymentIdAndReceiver<T>(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.info(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }

  async findReceiverAppByPaymentId<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string): Promise<AppInstance<T>> {
    this.log.debug(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.transferRepository.findTransferAppByPaymentIdAndSender<T>(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.debug(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }
}
