import {
  AppRegistry as RegistryOfApps,
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  validateSimpleSwapApp,
  validateFastSignedTransferApp,
  validateWithdrawApp,
  validateHashLockTransferApp,
} from "@connext/apps";
import {
  CoinBalanceRefundApp,
  SimpleLinkedTransferApp,
  SimpleTwoPartySwapApp,
  FastSignedTransferApp,
  WithdrawApp,
  AppInstanceJson,
  WithdrawAppStateBigNumber,
  HashLockTransferApp,
} from "@connext/types";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { SwapRateService } from "../swapRate/swapRate.service";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { CFCoreTypes } from "../util/cfCore";
import { LoggerService } from "../logger/logger.service";
import { Channel } from "../channel/channel.entity";
import { WithdrawService } from "../withdraw/withdraw.service";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly swapRateService: SwapRateService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly withdrawService: WithdrawService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
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

    // if error, reject install
    let installerChannel: Channel;
    try {
      installerChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(from);
      registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
        proposeInstallParams.appDefinition,
      );

      if (!registryAppInfo.allowNodeInstall) {
        throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
      }

      // dont install coin balance refund
      // TODO: need to validate this still
      if (registryAppInfo.name === CoinBalanceRefundApp) {
        this.log.debug(`Not installing coin balance refund app, emitting proposalAccepted event`);
        const proposalAcceptedSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appInstanceId}.proposal.accept`;
        await this.messagingService.publish(proposalAcceptedSubject, proposeInstallParams);
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

    const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appInstance.identityHash}.install`;
    await this.messagingService.publish(installSubject, appInstance);
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
        validateSimpleLinkedTransferApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        break;
      }
      case SimpleTwoPartySwapApp: {
        const allowedSwaps = this.configService.getAllowedSwaps();
        const ourRate = await this.swapRateService.getOrFetchRate(
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
      case WithdrawApp: {
        validateWithdrawApp(proposeInstallParams, from, this.cfCoreService.cfCore.publicIdentifier);
        break;
      }
      case HashLockTransferApp: {
        const blockNumber = await this.configService.getEthProvider().getBlockNumber();
        validateHashLockTransferApp(
          proposeInstallParams,
          blockNumber,
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
      case WithdrawApp: {
        this.log.debug(`Doing withdrawal post-install tasks`);
        const appInstance = await this.cfCoreService.getAppInstanceDetails(appInstanceId);
        const initialState = proposeInstallParams.initialState as WithdrawAppStateBigNumber;
        this.log.debug(`AppRegistry sending withdrawal to db at ${appInstance.multisigAddress}`);
        await this.withdrawService.saveWithdrawal(
          appInstanceId,
          bigNumberify(proposeInstallParams.initiatorDeposit),
          proposeInstallParams.initiatorDepositTokenAddress,
          initialState.transfers[0].to,
          initialState.data,
          initialState.signatures[0],
          initialState.signatures[1],
          appInstance.multisigAddress,
        );
        this.withdrawService.handleUserWithdraw(appInstance);
        break;
      }
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

  async onModuleInit() {
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
        `Creating ${app.name} app on chain ${ethNetwork.chainId}: ${appDefinitionAddress}`,
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
