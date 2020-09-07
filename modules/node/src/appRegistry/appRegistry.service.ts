import { validateSimpleSwapApp, generateValidationMiddleware } from "@connext/apps";
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
  DepositAppState,
  ProtocolRoles,
  ProposeMiddlewareContext,
  ConditionalTransferAppNames,
  DepositAppName,
  GenericConditionalTransferAppState,
  DefaultApp,
  ConditionalTransferTypes,
  ProtocolParams,
  AppAction,
  PriceOracleTypes,
  InstallMiddlewareContext,
  RequireOnlineApps,
} from "@connext/types";
import { getAddressFromAssetId, toBN, stringify } from "@connext/utils";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { BigNumber } from "ethers";

import { AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { DepositService } from "../deposit/deposit.service";
import { LoggerService } from "../logger/logger.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { WithdrawService } from "../withdraw/withdraw.service";
import { TransferService } from "../transfer/transfer.service";
import { TransferRepository } from "../transfer/transfer.repository";

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly transferService: TransferService,
    private readonly swapRateService: SwapRateService,
    private readonly withdrawService: WithdrawService,
    private readonly depositService: DepositService,
    private readonly channelRepository: ChannelRepository,
    private readonly transferRepository: TransferRepository,
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

    let registryAppInfo: DefaultApp;

    // if error, reject install
    let installerChannel: Channel | undefined;
    try {
      installerChannel = await this.channelRepository.findByAppIdentityHashOrThrow(appIdentityHash);
      registryAppInfo = this.cfCoreService.getAppInfoByAppDefinitionAddress(
        proposeInstallParams.appDefinition,
      )!;

      if (!registryAppInfo.allowNodeInstall) {
        throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
      }

      // begin transfer flow in middleware. if the transfer type requires that a
      // recipient is online, it will error here. Otherwise, it will return
      // without erroring and wait for the recipient to come online and reclaim
      // TODO: break into flows for deposit, withdraw, swap, and transfers
      if (
        Object.values(ConditionalTransferAppNames).includes(
          registryAppInfo.name as ConditionalTransferTypes,
        )
      ) {
        await this.transferService.transferAppInstallFlow(
          appIdentityHash,
          proposeInstallParams,
          from,
          installerChannel,
          registryAppInfo.name as ConditionalTransferTypes,
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
            installerChannel.chainId,
            proposeInstallParams.responderDepositAssetId,
            responderDepositBigNumber,
            freeBal[this.cfCoreService.cfCore.signerAddress],
          );
          this.log.info(
            `Calculated collateral amount to cover payment and rebalance: ${amount.toString()}`,
          );
          // request collateral and wait for deposit to come through\
          let depositError: Error | undefined = undefined;
          try {
            const depositResponse = await this.depositService.deposit(
              installerChannel,
              amount,
              proposeInstallParams.responderDepositAssetId,
            );
            if (!depositResponse) {
              throw new Error(`Node failed to install deposit app`);
            }
            this.log.info(
              `Installed deposit app in channel ${installerChannel.multisigAddress}, waiting for completion`,
            );
            await depositResponse.completed();
          } catch (e) {
            depositError = e;
          }
          if (depositError) {
            throw new Error(
              `Could not deposit sufficient collateral to install app for channel ${installerChannel.multisigAddress}. ${depositError.message}`,
            );
          }
        }
      }
      await this.cfCoreService.installApp(appIdentityHash, installerChannel);
      // any tasks that need to happen after install, i.e. DB writes
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.message || e}`);
      await this.cfCoreService.rejectInstallApp(appIdentityHash, installerChannel!, e.message);
      return;
    }
    try {
      await this.runPostInstallTasks(registryAppInfo, appIdentityHash, proposeInstallParams);
    } catch (e) {
      this.log.warn(
        `Run post install tasks failed: ${e.message || e}, uninstalling app ${appIdentityHash}`,
      );
      await this.cfCoreService.uninstallApp(appIdentityHash, installerChannel);
    }
  }

  private async runPostInstallTasks(
    registryAppInfo: DefaultApp,
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
    const networkContexts = this.configService.getNetworkContexts();
    const defaultValidation = await generateValidationMiddleware(
      networkContexts,
      this.configService.getSupportedTokens(),
      () => Promise.resolve("1"), // incoming proposals to the node should always have a swap rate of 1, will need to address for multihop
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

  private proposeMiddleware = async (cxt: ProposeMiddlewareContext) => {
    const { proposal, params, stateChannel } = cxt;
    const contractAddresses = this.configService.getContractAddresses(stateChannel.chainId);

    switch (proposal.appDefinition) {
      case contractAddresses.SimpleTwoPartySwapApp: {
        const responderDecimals = await this.configService.getTokenDecimals(
          stateChannel.chainId,
          params.responderDepositAssetId,
        );
        const allowedSwaps = this.configService.getAllowedSwaps(stateChannel.chainId);
        const swap = allowedSwaps.find(
          (swap) =>
            getAddressFromAssetId(swap.from) ===
              getAddressFromAssetId(params.initiatorDepositAssetId) &&
            getAddressFromAssetId(swap.to) ===
              getAddressFromAssetId(params.responderDepositAssetId) &&
            swap.fromChainId === stateChannel.chainId &&
            swap.toChainId === stateChannel.chainId,
        );
        if (swap?.priceOracleType === PriceOracleTypes.ACCEPT_CLIENT_RATE) {
          this.log.warn(
            `Swap is configured to dangerously use client input rate! ${stringify(swap, true, 0)}`,
          );
          return;
        }
        return validateSimpleSwapApp(
          params as any,
          allowedSwaps,
          await this.swapRateService.getOrFetchRate(
            getAddressFromAssetId(params.initiatorDepositAssetId),
            getAddressFromAssetId(params.responderDepositAssetId),
            stateChannel.chainId,
            stateChannel.chainId, // swap within a channel is only on a single chain
          ),
          responderDecimals,
        );
      }
    }
  };

  private installOfflineTransferMiddleware = async (
    appInstance: AppInstanceJson,
    role: ProtocolRoles,
    params: ProtocolParams.Install,
  ) => {
    const match = await this.transferRepository.findByPaymentId(appInstance.meta.paymentId);
    this.log.info(`installOfflineTransferMiddleware - match: ${stringify(match)}`);
    if (match?.receiverApp) {
      throw new Error(
        `Node has already installed or completed linked transfer for this paymentId: ${stringify(
          match,
          true,
          0,
        )}`,
      );
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
    params: ProtocolParams.Uninstall,
  ) => {
    // if we initiated the protocol, we dont need to have this check
    if (role === ProtocolRoles.initiator) {
      return;
    }

    const nodeSignerAddress = await this.configService.getSignerAddress();
    const senderAppLatestState = appInstance.latestState as GenericConditionalTransferAppState;

    const paymentId = appInstance.meta.paymentId;

    // only run validation against sender app uninstall
    if (senderAppLatestState.coinTransfers[1].to !== nodeSignerAddress) {
      // add secret for receiver app uninstalls
      this.log.info(
        `Found action for receiver: ${stringify(
          params.action,
          true,
          0,
        )}, adding to transfer tracker`,
      );
      await this.transferRepository.addTransferAction(
        paymentId,
        params.action as AppAction,
        appInstance.identityHash,
      );
      return;
    }

    let receiverApp = await this.transferService.findReceiverAppByPaymentId(paymentId);

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
          receiverApp.channel,
          params.action as any,
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

    // double check that receiver app state has not been finalized
    // only allow sender uninstall prior to receiver uninstall IFF the hub
    // has not paid receiver. Receiver app will be uninstalled again on event
    if (
      toBN(senderAppLatestState.coinTransfers[1].amount).isZero() && // not reclaimed
      toBN(receiverApp!.latestState.coinTransfers[0].amount).isZero() // finalized
    ) {
      throw new Error(
        `Cannot uninstall unfinalized sender app, receiver app has payment has been completed`,
      );
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

    const channel = await this.channelRepository.findByMultisigAddressOrThrow(
      appInstance.multisigAddress,
    );
    const depositApps = await this.cfCoreService.getAppInstancesByAppDefinition(
      channel.multisigAddress,
      this.cfCoreService.getAppInfoByNameAndChain(DepositAppName, channel.chainId)!
        .appDefinitionAddress,
    );
    const signerAddr = await this.configService.getSignerAddress();
    const ours = depositApps.find((app) => {
      const installedState = app.latestState as DepositAppState;
      return (
        installedState.assetId === latestState.assetId &&
        installedState.transfers[0].to === signerAddr
      );
    });
    if (ours) {
      throw new Error(
        `Cannot uninstall deposit app with active collateralization. App: ${ours.identityHash}`,
      );
    }
    return;
  };

  private installMiddleware = async (cxt: InstallMiddlewareContext): Promise<void> => {
    const { appInstance, role, params } = cxt;
    const appDef = appInstance.appDefinition;

    const appRegistryInfo = this.cfCoreService.getAppInfoByAppDefinitionAddress(appDef);
    const appName = appRegistryInfo!.name;
    const isTransfer = Object.keys(ConditionalTransferAppNames).includes(appName);
    if (isTransfer) {
      // Save the transfer
      const paymentId = appInstance.meta.paymentId;
      const match = await this.transferRepository.findByPaymentId(paymentId);
      if (match?.receiverApp) {
        // Add the receiver app to the transfer if it exists (which it should
        // as soon as it is proposed)
        await this.transferRepository.addTransferReceiver(paymentId, match.receiverApp);
      }
      const requireOnline =
        RequireOnlineApps.includes(appName) || params.proposal?.meta?.requireOnline;
      if (!requireOnline) {
        return this.installOfflineTransferMiddleware(appInstance, role, params);
      }
    }
  };

  private uninstallMiddleware = async (cxt: UninstallMiddlewareContext): Promise<void> => {
    const { appInstance, role, params } = cxt;
    const appDef = appInstance.appDefinition;

    const appRegistryInfo = this.cfCoreService.getAppInfoByAppDefinitionAddress(appDef);

    if (Object.keys(ConditionalTransferAppNames).includes(appRegistryInfo!.name)) {
      return this.uninstallTransferMiddleware(appInstance, role, params);
    }

    if (appRegistryInfo!.name === DepositAppName) {
      return this.uninstallDepositMiddleware(appInstance, role);
    }
  };

  async onModuleInit() {
    this.log.info(`Injecting CF Core middleware`);
    this.cfCoreService.cfCore.injectMiddleware(Opcode.OP_VALIDATE, await this.generateMiddleware());
    this.log.info(`Injected CF Core middleware`);
  }
}
