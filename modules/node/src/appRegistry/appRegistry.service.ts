import {
  AppRegistry as RegistryOfApps, // TODO: fix collision
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  validateSimpleSwapApp,
  validateWithdrawApp,
  validateHashLockTransferApp,
  validateSignedTransferApp,
  validateDepositApp,
  generateValidationMiddleware,
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
  Opcode,
  UninstallMiddlewareContext,
  ProtocolName,
  MiddlewareContext,
  ProtocolNames,
  InstallMiddlewareContext,
  DepositAppState,
  ProtocolRoles,
} from "@connext/types";
import { getAddressFromAssetId } from "@connext/utils";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingProviderId } from "../constants";
import { SwapRateService } from "../swapRate/swapRate.service";
import { LoggerService } from "../logger/logger.service";
import { Channel } from "../channel/channel.entity";
import { WithdrawService } from "../withdraw/withdraw.service";
import { DepositService } from "../deposit/deposit.service";
import { HashLockTransferService } from "../hashLockTransfer/hashLockTransfer.service";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { AppType } from "../appInstance/appInstance.entity";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly cfCoreStore: CFCoreStore,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly hashlockTransferService: HashLockTransferService,
    private readonly signedTransferService: SignedTransferService,
    private readonly swapRateService: SwapRateService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly withdrawService: WithdrawService,
    private readonly depositService: DepositService,
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
    this.log.info(
      `validateAndInstallOrReject for app ${appIdentityHash} with params ${JSON.stringify(
        proposeInstallParams,
      )} from ${from} started`,
    );

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

      // check if we need to collateralize, only for swap app
      if (registryAppInfo.name === SimpleTwoPartySwapAppName) {
        const freeBal = await this.cfCoreService.getFreeBalance(
          from,
          installerChannel.multisigAddress,
          proposeInstallParams.responderDepositAssetId,
        );
        const responderDepositBigNumber = bigNumberify(proposeInstallParams.responderDeposit);
        if (freeBal[this.cfCoreService.cfCore.signerAddress].lt(responderDepositBigNumber)) {
          const amount = responderDepositBigNumber.sub(
            freeBal[this.cfCoreService.cfCore.signerAddress],
          );
          const depositReceipt = await this.depositService.deposit(
            installerChannel,
            amount,
            proposeInstallParams.responderDepositAssetId,
          );
          if (!depositReceipt) {
            throw new Error(
              `Could not obtain sufficient collateral to install app for channel ${installerChannel.multisigAddress}.`,
            );
          }
        }
      }
      ({ appInstance } = await this.cfCoreService.installApp(appIdentityHash));
      // any tasks that need to happen after install, i.e. DB writes
      await this.runPostInstallTasks(
        registryAppInfo,
        appIdentityHash,
        proposeInstallParams,
        from,
        installerChannel,
      );
      const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appInstance.identityHash}.install`;
      await this.messagingService.publish(installSubject, appInstance);
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(appIdentityHash);
      return;
    }
  }

  private async runPreInstallValidation(
    registryAppInfo: AppRegistry,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
  ): Promise<void> {
    this.log.info(`runPreInstallValidation for app name ${registryAppInfo.name} started`);
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
        validateSimpleSwapApp(
          proposeInstallParams,
          this.configService.getAllowedSwaps(),
          await this.swapRateService.getOrFetchRate(
            getAddressFromAssetId(proposeInstallParams.initiatorDepositAssetId),
            getAddressFromAssetId(proposeInstallParams.responderDepositAssetId),
          ),
        );
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
        await this.hashlockTransferService.installHashLockTransferReceiverApp(
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
    this.log.info(`runPreInstallValidation for app name ${registryAppInfo.name} completed`);
  }

  private async runPostInstallTasks(
    registryAppInfo: AppRegistry,
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    channel: Channel,
  ): Promise<void> {
    this.log.info(
      `runPostInstallTasks for app name ${registryAppInfo.name} ${appIdentityHash} started`,
    );
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
            .then((response) =>
              this.log.info(`Installed recipient app: ${response.appIdentityHash}`),
            )
            .catch((e) =>
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
    this.log.info(
      `runPostInstallTasks for app ${registryAppInfo.name} ${appIdentityHash} completed`,
    );
  }

  // APP SPECIFIC MIDDLEWARE
  public generateMiddleware = async () => {
    const contractAddresses = await this.configService.getContractAddresses();
    const provider = this.configService.getEthProvider();
    const defaultValidation = await generateValidationMiddleware({
      ...contractAddresses,
      provider: provider as any,
    });

    return async (protocol: ProtocolName, cxt: MiddlewareContext) => {
      await defaultValidation(protocol, cxt);
      switch (protocol) {
        case ProtocolNames.setup:
        case ProtocolNames.propose:
        case ProtocolNames.takeAction: {
          return;
        }
        case ProtocolNames.install: {
          return await this.installMiddleware(cxt as InstallMiddlewareContext);
        }
        case ProtocolNames.uninstall: {
          return await this.uninstallMiddleware(cxt as UninstallMiddlewareContext);
        }
        default: {
          const unexpected: never = protocol;
          throw new Error(`Unexpected case: ${unexpected}`);
        }
      }
    };
  };

  private installMiddleware = async (cxt: InstallMiddlewareContext) => {
    const { appInstance } = cxt;
    const appDef = appInstance.appInterface.addr;

    const contractAddresses = await this.configService.getContractAddresses();

    switch (appDef) {
      case contractAddresses.HashLockTransferApp: {
        return await this.installHashLockTransferMiddleware(appInstance);
      }
      default: {
        // middleware for app not configured
        return;
      }
    }
  };

  private installHashLockTransferMiddleware = async (appInstance: AppInstanceJson) => {
    const latestState = appInstance.latestState as HashLockTransferAppState;
    const senderAddress = latestState.coinTransfers[0].to;

    const nodeSignerAddress = await this.configService.getSignerAddress();

    if (senderAddress !== nodeSignerAddress) {
      // node is not sending funds, we dont need to do anything
      return;
    }

    const existingSenderApp = await this.hashlockTransferService.findSenderAppByLockHashAndAssetId(
      latestState.lockHash,
      appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
    );

    if (!existingSenderApp) {
      throw new Error(`Sender app has not been proposed for lockhash ${latestState.lockHash}`);
    }
    if (existingSenderApp.type !== AppType.PROPOSAL) {
      this.log.warn(
        `Sender app already exists for lockhash ${latestState.lockHash}, will not install`,
      );
      return;
    }

    // install sender app
    this.log.info(
      `installHashLockTransferMiddleware: Install sender app ${existingSenderApp.identityHash} for user ${appInstance.initiatorIdentifier} started`,
    );
    const res = await this.cfCoreService.installApp(existingSenderApp.identityHash);
    const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${existingSenderApp.channel.multisigAddress}.app-instance.${existingSenderApp.identityHash}.install`;
    await this.messagingService.publish(installSubject, appInstance);
    this.log.info(
      `installHashLockTransferMiddleware: Install sender app ${
        res.appInstance.identityHash
      } for user ${appInstance.initiatorIdentifier} complete: ${JSON.stringify(res)}`,
    );
  };

  private uninstallMiddleware = async (cxt: UninstallMiddlewareContext) => {
    const { appInstance, role } = cxt;
    const appDef = appInstance.appInterface.addr;

    const contractAddresses = await this.configService.getContractAddresses();
    const nodeSignerAddress = await this.configService.getSignerAddress();

    switch (appDef) {
      case contractAddresses.DepositApp: {
        // do not respond to user requests to uninstall deposit
        // apps if node is depositor and there is an active collateralization
        const latestState = appInstance.latestState as DepositAppState;
        if (latestState.transfers[0].to !== nodeSignerAddress || role === ProtocolRoles.initiator) {
          return;
        }

        const channel = await this.cfCoreStore.getChannel(appInstance.multisigAddress);
        if (channel.activeCollateralizations[latestState.assetId]) {
          throw new Error(`Cannot uninstall deposit app with active collateralization`);
        }
        return;
      }
      default: {
        // middleware for app not configured
        return;
      }
    }
  };

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
      this.log.info(
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

    this.log.info(`Injecting CF Core middleware`);
    this.cfCoreService.cfCore.injectMiddleware(Opcode.OP_VALIDATE, await this.generateMiddleware());
    this.log.info(`Injected CF Core middleware`);
  }
}
