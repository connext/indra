import {
  AppRegistry as RegistryOfApps, // TODO: fix collision
  commonAppProposalValidation,
  validateSimpleSwapApp,
  validateWithdrawApp,
  validateDepositApp,
  generateValidationMiddleware,
  validateHashLockTransferApp,
  validateSimpleLinkedTransferApp,
  validateSignedTransferApp,
} from "@connext/apps";
import {
  AppInstanceJson,
  MethodParams,
  SimpleTwoPartySwapAppName,
  WithdrawAppName,
  WithdrawAppState,
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
  SimpleLinkedTransferAppState,
  ProposeMiddlewareContext,
  AppInstanceProposal,
  ConditionalTransferAppNames,
  HashLockTransferAppState,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
} from "@connext/types";
import { getAddressFromAssetId, stringify } from "@connext/utils";
import { Injectable, Inject, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { JsonRpcProvider } from "ethers/providers";
import { bigNumberify } from "ethers/utils";

import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { DepositService } from "../deposit/deposit.service";
import { HashLockTransferService } from "../hashLockTransfer/hashLockTransfer.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId } from "../constants";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { TransferService } from "../transfer/transfer.service";

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
    private readonly transferService: TransferService,
    private readonly hashlockTransferService: HashLockTransferService,
    private readonly signedTransferService: SignedTransferService,
    private readonly swapRateService: SwapRateService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly withdrawService: WithdrawService,
    private readonly depositService: DepositService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
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

      await this.runPreInstallValidation(
        registryAppInfo,
        proposeInstallParams,
        from,
        installerChannel,
      );

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

      // check if we need to collateralize, only for swap app
      if (registryAppInfo.name === SimpleTwoPartySwapAppName) {
        const freeBal = await this.cfCoreService.getFreeBalance(
          from,
          installerChannel.multisigAddress,
          proposeInstallParams.responderDepositAssetId,
        );
        const responderDepositBigNumber = bigNumberify(proposeInstallParams.responderDeposit);
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
      ({ appInstance } = await this.cfCoreService.installApp(
        appIdentityHash,
        installerChannel.multisigAddress,
      ));
      // any tasks that need to happen after install, i.e. DB writes
      await this.runPostInstallTasks(
        registryAppInfo,
        appIdentityHash,
        proposeInstallParams,
        from,
        installerChannel,
      );
      const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appIdentityHash}.install`;
      await this.messagingService.publish(installSubject, appInstance);
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(appIdentityHash, installerChannel.multisigAddress);
      return;
    }
  }

  private async runPreInstallValidation(
    registryAppInfo: AppRegistry,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    channel: Channel,
  ): Promise<void> {
    this.log.info(`runPreInstallValidation for app name ${registryAppInfo.name} started`);
    const supportedAddresses = this.configService.getSupportedTokenAddresses();
    commonAppProposalValidation(proposeInstallParams, registryAppInfo, supportedAddresses);
    switch (registryAppInfo.name) {
      case ConditionalTransferAppNames.HashLockTransferApp: {
        const blockNumber = await this.configService.getEthProvider().getBlockNumber();
        this.log.debug(`Start validateHashLockTransferApp`);
        validateHashLockTransferApp(
          proposeInstallParams,
          blockNumber,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        this.log.debug(`Finish validateHashLockTransferApp`);
        break;
      }
      case ConditionalTransferAppNames.SimpleLinkedTransferApp: {
        this.log.debug(`Start validateSimpleLinkedTransferApp`);
        validateSimpleLinkedTransferApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        this.log.debug(`Finish validateSimpleLinkedTransferApp`);
        break;
      }
      case ConditionalTransferAppNames.SimpleSignedTransferApp: {
        this.log.debug(`Start validateSignedTransferApp`);
        validateSignedTransferApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
        );
        this.log.debug(`Finish validateSignedTransferApp`);
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
        const appInstances = await this.cfCoreService.getAppInstances(channel.multisigAddress);
        const depositApp = appInstances.find(
          (appInstance) =>
            appInstance.appInterface.addr === registryAppInfo.appDefinitionAddress &&
            (appInstance.latestState as DepositAppState).assetId ===
              proposeInstallParams.initiatorDepositAssetId,
        );
        if (depositApp) {
          throw new Error(
            `Deposit app already installed for this assetId, rejecting (${depositApp.identityHash})`,
          );
        }
        await validateDepositApp(
          proposeInstallParams,
          from,
          this.cfCoreService.cfCore.publicIdentifier,
          (await this.channelRepository.findByUserPublicIdentifierOrThrow(from)).multisigAddress,
          this.configService.getEthProvider(),
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
      default:
        this.log.debug(`No post-install actions configured for app name ${registryAppInfo.name}.`);
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
      contractAddresses,
      provider: provider as JsonRpcProvider,
    });

    return async (protocol: ProtocolName, cxt: MiddlewareContext) => {
      await defaultValidation(protocol, cxt);
      switch (protocol) {
        case ProtocolNames.setup:
        case ProtocolNames.takeAction:
        case ProtocolNames.sync: {
          return;
        }
        case ProtocolNames.propose: {
          return await this.proposeMiddleware(cxt as ProposeMiddlewareContext);
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

  private installTransferMiddleware = async (appInstance: AppInstanceJson) => {
    const latestState = appInstance.latestState as HashLockTransferAppState;
    const senderAddress = latestState.coinTransfers[0].to;

    const nodeSignerAddress = await this.configService.getSignerAddress();

    if (senderAddress !== nodeSignerAddress) {
      // node is not sending funds, we dont need to do anything
      return;
    }

    const existingSenderAppProposal = await this.transferService.findSenderAppByPaymentId(
      appInstance.meta.paymentId,
    );

    if (!existingSenderAppProposal) {
      throw new Error(`Sender app has not been proposed for lockhash ${latestState.lockHash}`);
    }
    if (existingSenderAppProposal.type !== AppType.PROPOSAL) {
      this.log.warn(
        `Sender app already exists for lockhash ${latestState.lockHash}, will not install`,
      );
      return;
    }

    // install sender app
    this.log.info(
      `installTransferMiddleware: Install sender app ${existingSenderAppProposal.identityHash} for user ${appInstance.initiatorIdentifier} started`,
    );
    const res = await this.cfCoreService.installApp(
      existingSenderAppProposal.identityHash,
      existingSenderAppProposal.channel.multisigAddress,
    );
    const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${existingSenderAppProposal.channel.multisigAddress}.app-instance.${existingSenderAppProposal.identityHash}.install`;
    await this.messagingService.publish(installSubject, appInstance);
    this.log.info(
      `installHashLockTransferMiddleware: Install sender app ${
        res.appInstance.identityHash
      } for user ${appInstance.initiatorIdentifier} complete: ${JSON.stringify(res)}`,
    );
  };

  private installMiddleware = async (cxt: InstallMiddlewareContext) => {
    const { appInstance } = cxt;
    const appDef = appInstance.appInterface.addr;

    const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(appDef);

    if (Object.keys(ConditionalTransferAppNames).includes(appRegistryInfo.name)) {
      await this.installTransferMiddleware(appInstance);
    }
  };

  private proposeMiddleware = async (cxt: ProposeMiddlewareContext) => {
    const { proposal } = cxt;

    const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      proposal.appDefinition,
    );

    switch (appRegistryInfo.name) {
      case SimpleLinkedTransferAppName: {
        return await this.proposeLinkedTransferMiddleware(proposal);
      }
      case SimpleSignedTransferAppName: {
        return await this.proposeSignedTransferMiddleware(proposal);
      }
      default: {
        // middleware for app not configured
        return;
      }
    }
  };

  private proposeLinkedTransferMiddleware = async (proposal: AppInstanceProposal) => {
    const { paymentId, coinTransfers } = proposal.initialState as SimpleLinkedTransferAppState;
    // if node is the receiver, ignore
    if (coinTransfers[0].to !== this.cfCoreService.cfCore.signerAddress) {
      return;
    }
    // node is sender, make sure app doesnt already exist
    const receiverApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.publicIdentifier,
    );
    if (receiverApp && receiverApp.type !== AppType.REJECTED) {
      throw new Error(
        `Found existing app for ${paymentId}, aborting linked transfer proposal. App: ${stringify(
          receiverApp,
        )}`,
      );
    }
  };

  private proposeSignedTransferMiddleware = async (proposal: AppInstanceProposal) => {
    const { paymentId, coinTransfers } = proposal.initialState as SimpleSignedTransferAppState;
    // if node is the receiver, ignore
    if (coinTransfers[0].to !== this.cfCoreService.cfCore.signerAddress) {
      return;
    }
    // node is sender, make sure app doesnt already exist
    const receiverApp = await this.signedTransferService.findReceiverAppByPaymentId(paymentId);
    if (receiverApp && receiverApp.type !== AppType.REJECTED) {
      throw new Error(
        `Found existing app for ${paymentId}, aborting signed transfer proposal. App: ${stringify(
          receiverApp,
        )}`,
      );
    }
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
    const contractAddresses = await this.configService.getContractAddresses();
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
      await this.appRegistryRepository.save(appRegistry);
    }

    this.log.info(`Injecting CF Core middleware`);
    this.cfCoreService.cfCore.injectMiddleware(Opcode.OP_VALIDATE, await this.generateMiddleware());
    this.log.info(`Injected CF Core middleware`);
  }
}
