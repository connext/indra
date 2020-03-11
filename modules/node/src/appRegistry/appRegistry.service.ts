import {
  AppRegistry as RegistryOfApps,
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  validateSimpleSwapApp,
  validateFastSignedTransferApp,
} from "@connext/apps";
import {
  AppInstanceJson,
  SimpleLinkedTransferAppStateBigNumber,
  CoinBalanceRefundApp,
  SimpleLinkedTransferApp,
  SimpleTwoPartySwapApp,
  FastSignedTransferApp,
} from "@connext/types";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { SwapRateService } from "../swapRate/swapRate.service";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { CFCoreTypes } from "../util/cfCore";
import { LoggerService } from "../logger/logger.service";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";

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
    private readonly linkedTransferService: LinkedTransferService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
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
    try {
      const installerChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(from);
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
          const transfer = await this.linkedTransferRepository.findByPaymentId(
            initialState.paymentId,
          );
          transfer.receiverAppInstanceId = appInstanceId;
          await this.linkedTransferRepository.save(transfer);
          this.log.debug(`Updated transfer with receiver appId!`);
        } else {
          await this.linkedTransferService.saveLinkedTransfer(
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
        }
        break;
      }
      case FastSignedTransferApp:
        break;
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
