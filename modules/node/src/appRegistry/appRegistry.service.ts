import {
  AppRegistry as RegistryOfApps, // TODO: fix collision
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  validateSimpleSwapApp,
  validateWithdrawApp,
  validateHashLockTransferApp,
  validateSignedTransferApp,
  validateDepositApp,
} from "@connext/apps";
import {
  AppInstanceJson,
  HashLockTransferAppName,
  MethodParams,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  SimpleTwoPartySwapAppName,
  WithdrawAppName,
  WithdrawAppState,
  HashLockTransferAppState,
  SimpleSignedTransferAppState,
  DepositAppName,
} from "@connext/types";
import { getAddressFromAssetId } from "@connext/utils";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { SwapRateService } from "../swapRate/swapRate.service";
import { LoggerService } from "../logger/logger.service";
import { Channel } from "../channel/channel.entity";
import { WithdrawService } from "../withdraw/withdraw.service";
import { HashLockTransferService } from "../hashLockTransfer/hashLockTransfer.service";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly hashlockTransferService: HashLockTransferService,
    private readonly signedTransferService: SignedTransferService,
    private readonly swapRateService: SwapRateService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly withdrawService: WithdrawService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async validateAndInstallOrReject(
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
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

      await this.runPreInstallValidation(registryAppInfo, proposeInstallParams, from);

      // check if we need to collateralize
      const freeBal = await this.cfCoreService.getFreeBalance(
        from,
        installerChannel.multisigAddress,
        proposeInstallParams.responderDepositAssetId,
      );
      const responderDepositBigNumber = bigNumberify(proposeInstallParams.responderDeposit);
      if (freeBal[this.cfCoreService.cfCore.signerAddress].lt(responderDepositBigNumber)) {
        const depositReceipt = await this.channelService.rebalance(
          from,
          getAddressFromAssetId(proposeInstallParams.responderDepositAssetId),
          RebalanceType.COLLATERALIZE,
          responderDepositBigNumber,
        );
        if (!depositReceipt) {
          throw new Error(
            `Could not collateralize sufficient collateral to install app for channel ${installerChannel.multisigAddress}.`,
          );
        }
      }
      // collateralized again in post-install tasks
      ({ appInstance } = await this.cfCoreService.installApp(appIdentityHash));
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(appIdentityHash);
      return;
    }

    // any tasks that need to happen after install, i.e. DB writes
    await this.runPostInstallTasks(registryAppInfo, appIdentityHash, proposeInstallParams, from);

    const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appInstance.identityHash}.install`;
    await this.messagingService.publish(installSubject, appInstance);
  }

  private async runPreInstallValidation(
    registryAppInfo: AppRegistry,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
  ): Promise<void> {
    const supportedAddresses = this.configService.getSupportedTokenAddresses();
    commonAppProposalValidation(proposeInstallParams, registryAppInfo, supportedAddresses);
    switch (registryAppInfo.name) {
      case SimpleLinkedTransferAppName: {
        validateSimpleLinkedTransferApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        break;
      }
      case SimpleTwoPartySwapAppName: {
        const allowedSwaps = this.configService.getAllowedSwaps();
        const ourRate = await this.swapRateService.getOrFetchRate(
          getAddressFromAssetId(proposeInstallParams.initiatorDepositAssetId),
          getAddressFromAssetId(proposeInstallParams.responderDepositAssetId),
        );
        validateSimpleSwapApp(proposeInstallParams, allowedSwaps, ourRate);
        break;
      }
      case WithdrawAppName: {
        await validateWithdrawApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        break;
      }
      case DepositAppName: {
        await validateDepositApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
          (await this.channelRepository.findByUserPublicIdentifierOrThrow(from)).multisigAddress,
          this.configService.getEthProvider(),
        );
        break;
      }
      case HashLockTransferAppName: {
        const blockNumber = await this.configService.getEthProvider().getBlockNumber();
        validateHashLockTransferApp(
          proposeInstallParams,
          blockNumber,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );

        // install for receiver or error
        // https://github.com/ConnextProject/indra/issues/942
        const recipient = proposeInstallParams.meta["recipient"];
        await this.hashlockTransferService.resolveHashLockTransfer(
          from,
          recipient,
          proposeInstallParams.initialState as HashLockTransferAppState,
          proposeInstallParams.initiatorDepositAssetId,
          proposeInstallParams.meta,
        );
        break;
      }
      case SimpleSignedTransferAppName: {
        validateSignedTransferApp(
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
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
  ): Promise<void> {
    switch (registryAppInfo.name) {
      case WithdrawAppName: {
        this.log.debug(`Doing withdrawal post-install tasks`);
        const appInstance = await this.cfCoreService.getAppInstance(appIdentityHash);
        const initialState = proposeInstallParams.initialState as WithdrawAppState;
        this.log.debug(`AppRegistry sending withdrawal to db at ${appInstance.multisigAddress}`);
        await this.withdrawService.saveWithdrawal(
          appIdentityHash,
          bigNumberify(proposeInstallParams.initiatorDeposit),
          proposeInstallParams.initiatorDepositAssetId,
          initialState.transfers[0].to,
          initialState.data,
          initialState.signatures[0],
          initialState.signatures[1],
          appInstance.multisigAddress,
        );
        this.withdrawService.handleUserWithdraw(appInstance);
        break;
      }
      case SimpleSignedTransferAppName: {
        this.log.warn(`Doing simple signed transfer post-install tasks`);
        if (proposeInstallParams.meta["recipient"]) {
          await this.signedTransferService
            .installSignedTransferReceiverApp(
              proposeInstallParams.meta["recipient"],
              (proposeInstallParams.initialState as SimpleSignedTransferAppState).paymentId,
            )
            // if receipient is not online, do not throw error, receipient can always unlock later
            .then(response => this.log.info(`Installed recipient app: ${response.appIdentityHash}`))
            .catch(e =>
              this.log.error(
                `Could not install receiver app, receiver was possibly offline? ${e.toString()}`,
              ),
            );
        }
        break;
      }
      default:
        this.log.debug(`No post-install actions configured.`);
    }
    // rebalance at the end without blocking
    this.channelService.rebalance(
      from,
      getAddressFromAssetId(proposeInstallParams.responderDepositAssetId),
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
