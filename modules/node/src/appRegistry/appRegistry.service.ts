import {
  CoinBalanceRefundApp,
  SimpleLinkedTransferApp,
  SimpleTwoPartySwapApp,
  AppRegistry as RegistryOfApps,
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  SimpleLinkedTransferAppStateBigNumber,
  validateSimpleSwapApp,
  FastSignedTransferApp,
  validateFastSignedTransferApp,
} from "@connext/apps";
import {
  AppInstanceJson,
  CoinTransfer,
  CoinTransferBigNumber,
  DefaultApp,
  stringify,
  bigNumberifyObj,
} from "@connext/types";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { SwapRateService } from "../swapRate/swapRate.service";
import { LinkedTransferStatus } from "../transfer/transfer.entity";
import { LinkedTransferRepository } from "../transfer/transfer.repository";
import { TransferService } from "../transfer/transfer.service";
import { CFCoreTypes } from "../util/cfCore";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly cfCoreService: CFCoreService,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly log: LoggerService,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
    private readonly swapRateService: SwapRateService,
    private readonly transferService: TransferService,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async validateAndInstallOrReject(
    appInstanceId: string,
    proposeInstallParams: CFCoreTypes.ProposeInstallParams,
    from: string,
  ): Promise<void> {
    let registryAppInfo: AppRegistry;
    let appInstance: AppInstanceJson;
    const installerChannel = await this.channelRepository.findByUserPublicIdentifier(from);
    if (!installerChannel) {
      throw new Error(`Channel for ${from} not found`);
    }

    // if error, reject install
    try {
      const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
        proposeInstallParams.appDefinition,
      );

      if (!registryAppInfo.allowNodeInstall) {
        throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
      }

      // dont install coin balance refund
      // TODO: need to validate this still
      if (registryAppInfo.name === CoinBalanceRefundApp) {
        this.log.debug(`Not installing coin balance refund app, emitting proposalAccepted event`);
        await this.messagingClient
          .emit(
            `indra.node.${this.cfCoreService.cfCore.publicIdentifier}.proposalAccepted.${installerChannel.multisigAddress}`,
            proposeInstallParams,
          )
          .toPromise();
        return;
      }

      await this.runPreInstallValidation(registryAppInfo, proposeInstallParams, from);

      // check if we need to collateralize
      const preInstallFreeBalance = await this.cfCoreService.getFreeBalance(
        from,
        installerChannel.multisigAddress,
        proposeInstallParams.responderDepositTokenAddress,
      );
      if (
        preInstallFreeBalance[this.cfCoreService.cfCore.freeBalanceAddress].lt(
          bigNumberify(proposeInstallParams.responderDeposit),
        )
      ) {
        this.log.info(`Collateralizing channel before rebalancing...`);
        // collateralize and wait for tx
        const tx = await this.channelService.rebalance(
          from,
          proposeInstallParams.responderDepositTokenAddress,
          RebalanceType.COLLATERALIZE,
          bigNumberify(proposeInstallParams.responderDeposit),
        );
        if (tx) {
          await tx.wait();
        }
      }
      ({ appInstance } = await this.cfCoreService.installApp(appInstanceId));
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed, . Error: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(appInstanceId);
      return;
    }

    // any tasks that need to happen after install, i.e. DB writes
    await this.runPostInstallTasks(registryAppInfo, appInstanceId, proposeInstallParams, from);

    await this.messagingClient
      .emit(
        `indra.node.${this.cfCoreService.cfCore.publicIdentifier}.install.${appInstance.identityHash}`,
        appInstance,
      )
      .toPromise();
  }

  private async runPreInstallValidation(
    registryAppInfo: AppRegistry,
    proposeInstallParams: CFCoreTypes.ProposeInstallParams,
    from: string,
  ): Promise<void> {
    const supportedAddresses = this.configService.getSupportedTokenAddresses();
    commonAppProposalValidation(proposeInstallParams, registryAppInfo, supportedAddresses);
    switch (registryAppInfo.name) {
      case SimpleLinkedTransferApp: {
        const {
          responderDeposit,
          initiatorDeposit,
          initialState: initialStateBadType,
        } = bigNumberifyObj(proposeInstallParams);
        const initiatorReclaiming = responderDeposit.gt(Zero) && initiatorDeposit.eq(Zero);
        if (initiatorReclaiming) {
          // special validation for resolving that needs to check node-specific things
          const initialState = bigNumberifyObj(
            initialStateBadType,
          ) as SimpleLinkedTransferAppStateBigNumber;
          await this.validateResolvingLinkedTransfer(responderDeposit, initialState);
        } else {
          // normal validation
          validateSimpleLinkedTransferApp(
            proposeInstallParams,
            from,
            this.cfCoreService.cfCore.publicIdentifier,
          );
        }
        break;
      }
      case SimpleTwoPartySwapApp: {
        const allowedSwaps = this.configService.getAllowedSwaps();
        const ourRate = this.swapRateService.getOrFetchRate(
          proposeInstallParams.initiatorDepositTokenAddress,
          proposeInstallParams.responderDepositTokenAddress,
        );
        validateSimpleSwapApp(proposeInstallParams, allowedSwaps, ourRate);
        break;
      }
      case FastSignedTransferApp: {
        validateFastSignedTransferApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        break;
      }
      default: {
        throw new Error(
          `Will not install app without configured validation: ${registryAppInfo.name}`,
        );
      }
    }
  }

  private async runPostInstallTasks(
    registryAppInfo: AppRegistry,
    appInstanceId: string,
    proposeInstallParams: CFCoreTypes.ProposeInstallParams,
    from: string,
  ): Promise<void> {
    switch (registryAppInfo.name) {
      case SimpleLinkedTransferApp: {
        this.log.debug(`Saving linked transfer`);
        // eslint-disable-next-line max-len
        const initialState = proposeInstallParams.initialState as SimpleLinkedTransferAppStateBigNumber;

        const isResolving = proposeInstallParams.responderDeposit.gt(Zero);
        if (isResolving) {
          const transfer = await this.transferService.getLinkedTransferByPaymentId(
            initialState.paymentId,
          );
          transfer.receiverAppInstanceId = appInstanceId;
          await this.linkedTransferRepository.save(transfer);
          this.log.debug(`Updated transfer with receiver appId!`);
          return;
        }
        await this.transferService.saveLinkedTransfer(
          from,
          proposeInstallParams.initiatorDepositTokenAddress,
          bigNumberify(proposeInstallParams.initiatorDeposit),
          appInstanceId,
          initialState.linkedHash,
          initialState.paymentId,
          proposeInstallParams.meta["encryptedPreImage"],
          proposeInstallParams.meta["recipient"],
          proposeInstallParams.meta,
        );
        this.log.debug(`Linked transfer saved!`);
        break;
      }
      // TODO: add something for swap app? maybe for history preserving reasons.
      default:
        this.log.debug(`No post-install actions configured.`);
    }
    // rebalance at the end without blocking
    this.channelService.rebalance(
      from,
      proposeInstallParams.responderDepositTokenAddress,
      RebalanceType.RECLAIM,
    );
  }

  private async validateResolvingLinkedTransfer(
    responderDeposit: BigNumber,
    initialState: SimpleLinkedTransferAppStateBigNumber,
  ) {
    initialState.coinTransfers = initialState.coinTransfers.map(
      (transfer: CoinTransfer<BigNumber>) => bigNumberifyObj(transfer),
    ) as any;

    const nodeTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
      return transfer.to === this.cfCoreService.cfCore.freeBalanceAddress;
    })[0];
    const resolverTransfer = initialState.coinTransfers.filter(
      (transfer: CoinTransferBigNumber) => {
        return transfer.to !== this.cfCoreService.cfCore.freeBalanceAddress;
      },
    )[0];
    if (!initialState.amount.eq(responderDeposit)) {
      throw new Error(
        `Payment amount must be the same as responder deposit ${stringify({
          responderDeposit,
          initialState,
        })}`,
      );
    }

    if (nodeTransfer.amount.lte(Zero)) {
      throw new Error(
        `Cannot resolve a linked transfer with a sender transfer of <= 0. Transfer amount: ${bigNumberify(
          initialState.coinTransfers[0].amount,
        ).toString()}`,
      );
    }

    if (!resolverTransfer.amount.eq(Zero)) {
      throw new Error(
        `Cannot resolve a linked transfer app with a receiver transfer of != 0. Transfer amount: ${bigNumberify(
          initialState.coinTransfers[1].amount,
        ).toString()}`,
      );
    }

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByPaymentId(initialState.paymentId);
    if (!transfer) {
      throw new Error(`No transfer exists for paymentId ${initialState.paymentId}`);
    }

    if (initialState.linkedHash !== transfer.linkedHash) {
      throw new Error(`No transfer exists for linkedHash ${initialState.linkedHash}`);
    }

    if (transfer.status === LinkedTransferStatus.REDEEMED) {
      throw new Error(
        `Transfer with linkedHash ${initialState.linkedHash} has already been redeemed`,
      );
    }

    // check that linked transfer app has been installed from sender
    const defaultApp = (await this.configService.getDefaultApps()).find(
      (app: DefaultApp) => app.name === SimpleLinkedTransferApp,
    );
    const installedApps = await this.cfCoreService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        app.appInterface.addr === defaultApp!.appDefinitionAddress &&
        (app.latestState as SimpleLinkedTransferAppStateBigNumber).linkedHash ===
          initialState.linkedHash,
    );

    if (!senderApp) {
      throw new Error(`App with provided hash has not been installed: ${initialState.linkedHash}`);
    }
  }

  async onModuleInit() {
    for (const app of await this.configService.getDefaultApps()) {
      let appRegistry = await this.appRegistryRepository.findByNameAndNetwork(
        app.name,
        app.chainId,
      );
      if (!appRegistry) {
        appRegistry = new AppRegistry();
      }
      this.log.info(
        `Creating ${app.name} app on chain ${app.chainId}: ${app.appDefinitionAddress}`,
      );
      appRegistry.actionEncoding = app.actionEncoding;
      appRegistry.appDefinitionAddress = app.appDefinitionAddress;
      appRegistry.name = app.name;
      appRegistry.chainId = app.chainId;
      appRegistry.outcomeType = app.outcomeType;
      appRegistry.stateEncoding = app.stateEncoding;
      appRegistry.allowNodeInstall = app.allowNodeInstall;
      await this.appRegistryRepository.save(appRegistry);
    }

    const ethNetwork = await this.configService.getEthNetwork();
    const addressBook = await this.configService.getContractAddresses();
    for (const app of RegistryOfApps) {
      let appRegistry = await this.appRegistryRepository.findByNameAndNetwork(
        app.name,
        ethNetwork.chainId,
      );
      if (!appRegistry) {
        appRegistry = new AppRegistry();
      }
      const appDefinitionAddress = addressBook[app.name];
      this.log.log(
        `Creating ${app.name} app on chain ${ethNetwork.chainId}: ${app.appDefinitionAddress}`,
      );
      appRegistry.actionEncoding = app.actionEncoding;
      appRegistry.appDefinitionAddress = appDefinitionAddress;
      appRegistry.name = app.name;
      appRegistry.chainId = ethNetwork.chainId;
      appRegistry.outcomeType = app.outcomeType;
      appRegistry.stateEncoding = app.stateEncoding;
      appRegistry.allowNodeInstall = app.allowNodeInstall;
      await this.appRegistryRepository.save(appRegistry);
    }
  }
}
