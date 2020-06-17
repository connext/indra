import {
  AppRegistry as RegistryOfApps, // TODO: fix collision
  validateSimpleSwapApp,
  generateValidationMiddleware,
} from "@connext/apps";
import {
  AppInstanceJson,
  MethodParams,
  SimpleTwoPartySwapAppName,
  WithdrawAppName,
  WithdrawAppState,
  Opcode,
  UninstallMiddlewareContext,
  ProtocolName,
  MiddlewareContext,
  ProtocolNames,
  InstallMiddlewareContext,
  DepositAppState,
  ProtocolRoles,
  ProposeMiddlewareContext,
  ConditionalTransferAppNames,
  HashLockTransferAppState,
  DepositAppName,
  GenericConditionalTransferAppState,
  getTransferTypeFromAppName,
} from "@connext/types";
import { getAddressFromAssetId } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { BigNumber, providers } from "ethers";

import { AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { DepositService } from "../deposit/deposit.service";
import { LoggerService } from "../logger/logger.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { TransferService } from "../transfer/transfer.service";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  public appRegistryArray: AppRegistry[];
  constructor(
    private readonly cfCoreStore: CFCoreStore,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly transferService: TransferService,
    private readonly swapRateService: SwapRateService,
    private readonly withdrawService: WithdrawService,
    private readonly depositService: DepositService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async installOrReject(
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
  ): Promise<void> {
    this.log.info(
      `installOrReject for app ${appIdentityHash} with params ${JSON.stringify(
        proposeInstallParams,
      )} from ${from} started`,
    );

    let registryAppInfo: AppRegistry;

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

      // begin transfer flow in middleware. if the transfer type requires that a
      // recipient is online, it will error here. Otherwise, it will return
      // without erroring and wait for the recipient to come online and reclaim
      // TODO: break into flows for deposit, withdraw, swap, and transfers
      if (
        Object.values(ConditionalTransferAppNames).includes(
          registryAppInfo.name as ConditionalTransferAppNames,
        )
      ) {
        await this.transferService.transferAppInstallFlow(
          appIdentityHash,
          proposeInstallParams,
          from,
          installerChannel,
          registryAppInfo.name as ConditionalTransferAppNames,
        );
        return;
      }

      // TODO: break into flows for deposit, withdraw, swap, and transfers
      // check if we need to collateralize, only for swap app
      if (registryAppInfo.name === SimpleTwoPartySwapAppName) {
        const freeBal = await this.cfCoreService.getFreeBalance(
          from,
          installerChannel.multisigAddress,
          proposeInstallParams.responderDepositAssetId,
        );
        const responderDepositBigNumber = BigNumber.from(proposeInstallParams.responderDeposit);
        if (freeBal[this.cfCoreService.cfCore.signerAddress].lt(responderDepositBigNumber)) {
          const amount = await this.channelService.getCollateralAmountToCoverPaymentAndRebalance(
            from,
            proposeInstallParams.responderDepositAssetId,
            responderDepositBigNumber,
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
      await this.cfCoreService.installApp(appIdentityHash, installerChannel.multisigAddress);
      // any tasks that need to happen after install, i.e. DB writes
      await this.runPostInstallTasks(registryAppInfo, appIdentityHash, proposeInstallParams);
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(
        appIdentityHash,
        installerChannel.multisigAddress,
        e.message,
      );
      return;
    }
  }

  private async runPostInstallTasks(
    registryAppInfo: AppRegistry,
    appIdentityHash: string,
    proposeInstallParams: MethodParams.ProposeInstall,
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
          BigNumber.from(proposeInstallParams.initiatorDeposit),
          proposeInstallParams.initiatorDepositAssetId,
          initialState.transfers[0].to,
          initialState.data,
          initialState.signatures[0],
          initialState.signatures[1],
          appInstance.multisigAddress,
        );
        await this.withdrawService.handleUserWithdraw(appInstance);
        break;
      }
      default:
        this.log.debug(`No post-install actions configured for app name ${registryAppInfo.name}.`);
    }
    this.log.info(
      `runPostInstallTasks for app ${registryAppInfo.name} ${appIdentityHash} completed`,
    );
  }

  // APP SPECIFIC MIDDLEWARE
  public generateMiddleware = async (): Promise<
    (protocol: ProtocolName, cxt: MiddlewareContext) => Promise<void>
  > => {
    const contractAddresses = await this.configService.getContractAddresses();
    const provider = this.configService.getEthProvider();
    const defaultValidation = await generateValidationMiddleware(
      {
        contractAddresses,
        provider: provider as providers.JsonRpcProvider,
      },
      this.configService.getSupportedTokenAddresses(),
    );

    return async (protocol: ProtocolName, cxt: MiddlewareContext): Promise<void> => {
      await defaultValidation(protocol, cxt);
      switch (protocol) {
        case ProtocolNames.setup:
        case ProtocolNames.takeAction:
        case ProtocolNames.sync: {
          return;
        }
        case ProtocolNames.propose: {
          return this.proposeMiddleware(cxt as ProposeMiddlewareContext);
        }
        case ProtocolNames.install: {
          return this.installMiddleware(cxt as InstallMiddlewareContext);
        }
        case ProtocolNames.uninstall: {
          return this.uninstallMiddleware(cxt as UninstallMiddlewareContext);
        }
        default: {
          const unexpected: never = protocol;
          throw new Error(`Unexpected case: ${unexpected}`);
        }
      }
    };
  };

  private installTransferMiddleware = async (appInstance: AppInstanceJson) => {
    const latestState = appInstance.latestState as HashLockTransferAppState;
    const senderAddress = latestState.coinTransfers[0].to;

    const nodeSignerAddress = await this.configService.getSignerAddress();

    // if node is not sending funds, we dont need to do anything
    if (senderAddress !== nodeSignerAddress) {
      return;
    }

    const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      appInstance.appDefinition,
    );

    // this middleware is only relevant for require online
    if (getTransferTypeFromAppName(registryAppInfo.name) === "AllowOffline") {
      return;
    }

    const existingSenderApp = await this.transferService.findSenderAppByPaymentId(
      appInstance.meta.paymentId,
    );

    if (!existingSenderApp) {
      throw new Error(`Sender app not installed`);
    }

    if (existingSenderApp.type === AppType.INSTANCE) {
      this.log.info(`Sender app was already installed, doing nothing.`);
      return;
    }

    if (existingSenderApp.type !== AppType.PROPOSAL) {
      throw new Error(`Sender app has not been proposed: ${appInstance.identityHash}`);
    }

    try {
      this.log.info(`Installing sender app from app proposal: ${appInstance.identityHash}`);
      await this.cfCoreService.installApp(
        existingSenderApp.identityHash,
        existingSenderApp.channel.multisigAddress,
      );
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(
        existingSenderApp.identityHash,
        existingSenderApp.channel.multisigAddress,
        e.message,
      );
      return;
    }
  };

  private installMiddleware = async (cxt: InstallMiddlewareContext) => {
    const { appInstance } = cxt;
    const appDef = appInstance.appDefinition;

    const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(appDef);

    if (Object.keys(ConditionalTransferAppNames).includes(appRegistryInfo.name)) {
      await this.installTransferMiddleware(appInstance);
    }
  };

  private proposeMiddleware = async (cxt: ProposeMiddlewareContext) => {
    const { proposal, params } = cxt;
    const contractAddresses = await this.configService.getContractAddresses();

    switch (proposal.appDefinition) {
      case contractAddresses.SimpleTwoPartySwapApp: {
        return validateSimpleSwapApp(
          params as any,
          this.configService.getAllowedSwaps(),
          await this.swapRateService.getOrFetchRate(
            getAddressFromAssetId(params.initiatorDepositAssetId),
            getAddressFromAssetId(params.responderDepositAssetId),
          ),
        );
      }
    }
  };

  /**
   * https://github.com/connext/indra/issues/863
   * The node must not allow a sender's transfer app to be uninstalled before the receiver.
   * If the sender app is installed, the node will try to uninstall the receiver app. If the
   * receiver app is uninstalled, it must be checked for the following case:
   * if !senderApp.latestState.finalized && receiverApp.latestState.finalized, then ERROR
   */
  private uninstallTransferMiddleware = async (
    appInstance: AppInstanceJson,
    role: ProtocolRoles,
  ) => {
    // if we initiated the protocol, we dont need to have this check
    if (role === ProtocolRoles.initiator) {
      return;
    }

    const nodeSignerAddress = await this.configService.getSignerAddress();
    const senderAppLatestState = appInstance.latestState as GenericConditionalTransferAppState;

    // only run validation against sender app uninstall
    if (senderAppLatestState.coinTransfers[1].to !== nodeSignerAddress) {
      return;
    }

    let receiverApp = await this.transferService.findReceiverAppByPaymentId(
      appInstance.meta.paymentId,
    );

    // TODO: VERIFY THIS
    // okay to allow uninstall if receiver app was not installed ever
    if (!receiverApp) {
      return;
    }

    this.log.info(`Starting uninstallTransferMiddleware for ${appInstance.identityHash}`);

    if (receiverApp.type !== AppType.UNINSTALLED) {
      this.log.info(
        `Found receiver app ${receiverApp.identityHash} with type ${receiverApp.type}, attempting uninstall`,
      );
      try {
        await this.cfCoreService.uninstallApp(
          receiverApp.identityHash,
          receiverApp.channel.multisigAddress,
        );
        this.log.info(`Receiver app ${receiverApp.identityHash} uninstalled`);
      } catch (e) {
        this.log.error(
          `Caught error uninstalling receiver app ${receiverApp.identityHash}: ${e.message}`,
        );
      }
      // TODO: can we optimize?
      // get new instance from store
      receiverApp = await this.transferService.findReceiverAppByPaymentId(
        appInstance.meta.paymentId,
      );
    }

    // double check that the app was uninstalled
    if (receiverApp.type !== AppType.UNINSTALLED) {
      throw new Error(`Receiver app was unable to be uninstalled`);
    }

    if (!senderAppLatestState.finalized && receiverApp.latestState.finalized) {
      throw new Error(`Cannot uninstall unfinalized sender app, receiver app has been finalized`);
    }
    this.log.info(`Finished uninstallTransferMiddleware for ${appInstance.identityHash}`);
  };

  private uninstallDepositMiddleware = async (
    appInstance: AppInstanceJson,
    role: ProtocolRoles,
  ): Promise<void> => {
    const nodeSignerAddress = await this.configService.getSignerAddress();
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
  };

  private uninstallMiddleware = async (cxt: UninstallMiddlewareContext): Promise<void> => {
    const { appInstance, role } = cxt;
    const appDef = appInstance.appDefinition;

    const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(appDef);

    if (Object.keys(ConditionalTransferAppNames).includes(appRegistryInfo.name)) {
      return this.uninstallTransferMiddleware(appInstance, role);
    }

    if (appRegistryInfo.name === DepositAppName) {
      return this.uninstallDepositMiddleware(appInstance, role);
    }
  };

  async onModuleInit() {
    const ethNetwork = await this.configService.getEthNetwork();
    const contractAddresses = await this.configService.getContractAddresses();
    const appRegistryArray = [];
    for (const app of RegistryOfApps) {
      let appRegistry = await this.appRegistryRepository.findByNameAndNetwork(
        app.name,
        ethNetwork.chainId,
      );
      if (!appRegistry) {
        appRegistry = new AppRegistry();
      }
      const appDefinitionAddress = contractAddresses[app.name];
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
      appRegistryArray.push(appRegistry);
      await this.appRegistryRepository.save(appRegistry);
    }

    this.appRegistryArray = appRegistryArray;

    this.log.info(`Injecting CF Core middleware`);
    this.cfCoreService.cfCore.injectMiddleware(Opcode.OP_VALIDATE, await this.generateMiddleware());
    this.log.info(`Injected CF Core middleware`);
  }
}
