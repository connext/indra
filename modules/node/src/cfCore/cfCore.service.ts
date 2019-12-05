import { NatsMessagingService } from "@connext/messaging";
import {
  AppActionBigNumber,
  ConnextNodeStorePrefix,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ConfigService } from "../config/config.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import { CLogger, replaceBN, stringify, xpubToAddress } from "../util";
import {
  AppInstanceJson,
  AppInstanceProposal,
  CFCore,
  CFCoreTypes,
  getCreate2MultisigAddress,
  InstallMessage,
  RejectProposalMessage,
} from "../util/cfCore";

import { CFCoreRecordRepository } from "./cfCore.repository";

const logger = new CLogger("CFCoreService");

Injectable();
export class CFCoreService {
  constructor(
    @Inject(CFCoreProviderId) public readonly cfCore: CFCore,
    private readonly configService: ConfigService,
    @Inject(MessagingProviderId) private readonly messagingProvider: NatsMessagingService,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {
    this.cfCore = cfCore;
  }

  async getFreeBalance(
    userPubId: string,
    multisigAddress: string,
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.GetFreeBalanceStateResult> {
    try {
      const freeBalance = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: CFCoreTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
        parameters: {
          multisigAddress,
          tokenAddress: assetId,
        },
      });
      return freeBalance.result.result as CFCoreTypes.GetFreeBalanceStateResult;
    } catch (e) {
      const error = `No free balance exists for the specified token: ${assetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the free balance address in the multisig
        const obj = {};
        obj[this.cfCore.freeBalanceAddress] = Zero;
        obj[xpubToAddress(userPubId)] = Zero;
        return obj;
      }
      logger.error(e.message, e.stack);
      throw e;
    }
  }

  // TODO: fix typings, is StateChannel exported?
  async getStateChannel(multisigAddress: string): Promise<{ data: any }> {
    const params = {
      id: Date.now(),
      methodName: "chan_getStateChannel", // FIXME: CFCoreTypes.RpcMethodName.GET_STATE_CHANNEL,
      parameters: {
        multisigAddress,
      },
    };
    const getStateChannelRes = await this.cfCore.rpcRouter.dispatch(params);
    return getStateChannelRes.result.result;
  }

  async createChannel(
    counterpartyPublicIdentifier: string,
  ): Promise<CFCoreTypes.CreateChannelResult> {
    const params = {
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.CREATE_CHANNEL,
      parameters: {
        owners: [this.cfCore.publicIdentifier, counterpartyPublicIdentifier],
      } as CFCoreTypes.CreateChannelParams,
    };
    logger.log(`Calling createChannel with params: ${JSON.stringify(params, replaceBN, 2)}`);
    const createRes = await this.cfCore.rpcRouter.dispatch(params);
    logger.log(`createChannel called with result: ${JSON.stringify(createRes.result.result)}`);
    return createRes.result.result as CFCoreTypes.CreateChannelResult;
  }

  async deployMultisig(
    multisigAddress: string,
  ): Promise<CFCoreTypes.DeployStateDepositHolderResult> {
    const params = {
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.DEPLOY_STATE_DEPOSIT_HOLDER,
      parameters: {
        multisigAddress,
      } as CFCoreTypes.DeployStateDepositHolderParams,
    };
    logger.log(
      `Calling chan_deployStateDepositHolder with params: ${JSON.stringify(params, replaceBN, 2)}`,
    );
    const deployRes = await this.cfCore.rpcRouter.dispatch(params);
    logger.log(
      `chan_deployStateDepositHolder called with result: ${JSON.stringify(
        deployRes.result.result,
      )}`,
    );
    return deployRes.result.result as CFCoreTypes.DeployStateDepositHolderResult;
  }

  async deposit(
    multisigAddress: string,
    amount: BigNumber,
    assetId: string = AddressZero,
  ): Promise<CFCoreTypes.DepositResult> {
    logger.debug(
      `Calling ${CFCoreTypes.RpcMethodName.DEPOSIT} with params: ${JSON.stringify({
        amount,
        multisigAddress,
        tokenAddress: assetId,
      })}`,
    );
    const depositRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.DEPOSIT,
      parameters: {
        amount,
        multisigAddress,
        tokenAddress: assetId,
      } as CFCoreTypes.DepositParams,
    });
    logger.debug(`deposit called with result ${JSON.stringify(depositRes.result.result)}`);
    const multisig = bigNumberify(depositRes.result.result.multisigBalance);
    if (multisig.lt(amount)) {
      logger.error(
        `multisig balance is lt deposit amount. deposited: ${multisig.toString()}, requested: ${amount.toString()}`,
      );
    }
    return depositRes.result.result as CFCoreTypes.DepositResult;
  }

  async proposeInstallApp(
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<CFCoreTypes.ProposeInstallResult> {
    logger.debug(
      `Calling ${CFCoreTypes.RpcMethodName.PROPOSE_INSTALL} with params: ${JSON.stringify(params)}`,
    );
    const proposeRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.PROPOSE_INSTALL,
      parameters: params,
    });
    logger.debug(
      `proposeInstallApp called with result ${JSON.stringify(proposeRes.result.result)}`,
    );
    return proposeRes.result.result as CFCoreTypes.ProposeInstallResult;
  }

  async proposeAndWaitForAccepted(
    params: CFCoreTypes.ProposeInstallParams,
    multisigAddress: string,
  ): Promise<CFCoreTypes.ProposeInstallResult> {
    let boundReject: (msg: RejectProposalMessage) => void;
    let proposeRes: CFCoreTypes.ProposeInstallResult;
    try {
      await new Promise(
        async (res: () => any, rej: (msg: string) => any): Promise<void> => {
          boundReject = this.rejectInstallTransfer.bind(null, rej);
          logger.debug(
            `Subscribing to: indra.client.${params.proposedToIdentifier}.proposalAccepted.${multisigAddress}`,
          );
          await this.messagingProvider.subscribe(
            `indra.client.${params.proposedToIdentifier}.proposalAccepted.${multisigAddress}`,
            res,
          );
          this.cfCore.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);

          proposeRes = await this.proposeInstallApp(params);
          logger.debug(`waiting for client to publish proposal results`);
        },
      );
      return proposeRes;
    } catch (e) {
      logger.error(`Error installing app: ${e.message}`, e.stack);
      throw e;
    } finally {
      this.cleanupProposalListeners(boundReject, multisigAddress, params.proposedToIdentifier);
    }
  }

  async proposeAndWaitForInstallApp(
    userPubId: string,
    initialState: any,
    initiatorDeposit: BigNumber,
    initiatorDepositTokenAddress: string,
    responderDeposit: BigNumber,
    responderDepositTokenAddress: string,
    app: SupportedApplication,
  ): Promise<CFCoreTypes.ProposeInstallResult | undefined> {
    let boundReject: (reason?: any) => void;

    const network = await this.configService.getEthNetwork();
    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(
      app,
      network.name as SupportedNetwork,
    );
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = appInfo;
    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit,
      initiatorDepositTokenAddress,
      outcomeType,
      proposedToIdentifier: userPubId,
      responderDeposit,
      responderDepositTokenAddress,
      timeout: Zero,
    };

    const proposeRes = await this.proposeInstallApp(params);

    try {
      await new Promise((res: () => any, rej: (msg: string) => any): void => {
        boundReject = this.rejectInstallTransfer.bind(null, rej);
        this.messagingProvider.subscribe(
          `indra.client.${userPubId}.install.${proposeRes.appInstanceId}`,
          this.resolveInstallTransfer.bind(null, res),
        );
        this.cfCore.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
      });
      logger.log(`App was installed successfully!: ${stringify(proposeRes)}`);
      return proposeRes;
    } catch (e) {
      logger.error(`Error installing app: ${e.message}`, e.stack);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, proposeRes.appInstanceId, userPubId);
    }
  }

  async installApp(appInstanceId: string): Promise<CFCoreTypes.InstallResult> {
    const installRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.INSTALL,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.InstallParams,
    });
    logger.log(`installApp called with result ${stringify(installRes.result.result)}`);
    return installRes.result.result as CFCoreTypes.InstallResult;
  }

  async rejectInstallApp(appInstanceId: string): Promise<CFCoreTypes.RejectInstallResult> {
    const rejectRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.RejectInstallParams,
    });
    logger.log(`rejectInstallApp called with result ${stringify(rejectRes.result.result)}`);
    return rejectRes.result.result as CFCoreTypes.RejectInstallResult;
  }

  async takeAction(
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<CFCoreTypes.TakeActionResult> {
    logger.log(`Taking action on app ${appInstanceId}: ${JSON.stringify(action, replaceBN, 2)}`);
    // check the app is actually installed
    await this.assertAppInstalled(appInstanceId);
    // check state is not finalized
    const state: CFCoreTypes.GetStateResult = await this.getAppState(appInstanceId);
    logger.log(`Taking action against state: ${JSON.stringify(state, replaceBN, 2)}`);
    // FIXME: casting?
    if ((state.state as any).finalized) {
      throw new Error("Cannot take action on an app with a finalized state.");
    }
    const actionResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.TAKE_ACTION,
      parameters: {
        action,
        appInstanceId,
      } as CFCoreTypes.TakeActionParams,
    });

    logger.log(
      `takeAction called with result: ${JSON.stringify(actionResponse.result, replaceBN, 2)}`,
    );
    return actionResponse.result.result as CFCoreTypes.TakeActionResult;
  }

  async uninstallApp(appInstanceId: string): Promise<CFCoreTypes.UninstallResult> {
    // check the app is actually installed
    await this.assertAppInstalled(appInstanceId);
    logger.log(`Calling uninstallApp for appInstanceId ${appInstanceId}`);
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.UNINSTALL,
      parameters: {
        appInstanceId,
      },
    });

    logger.log(
      `uninstallApp called with result ${JSON.stringify(uninstallResponse.result.result)}`,
    );
    return uninstallResponse.result.result as CFCoreTypes.UninstallResult;
  }

  async rescindDepositRights(
    multisigAddress: string,
    tokenAddress: string = AddressZero,
  ): Promise<CFCoreTypes.DepositResult> {
    // check the app is actually installed
    logger.log(`Calling rescindDepositRights`);
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS,
      parameters: { multisigAddress, tokenAddress } as CFCoreTypes.RescindDepositRightsParams,
    });

    logger.log(
      `rescindDepositRights called with result ${JSON.stringify(uninstallResponse.result.result)}`,
    );
    return uninstallResponse.result.result as CFCoreTypes.DepositResult;
  }

  async getAppInstances(): Promise<AppInstanceJson[]> {
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_APP_INSTANCES,
      parameters: {} as CFCoreTypes.GetAppInstancesParams,
    });

    /*
    logger.debug(
      `getAppInstances called with result ${JSON.stringify(appInstanceResponse.result.result)}`,
    );
    */
    return appInstanceResponse.result.result.appInstances as AppInstanceJson[];
  }

  async getProposedAppInstances(): Promise<AppInstanceProposal[]> {
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {} as CFCoreTypes.GetAppInstancesParams,
    });

    logger.log(
      `getProposedAppInstances called with result ${JSON.stringify(
        appInstanceResponse.result.result,
      )}`,
    );
    return appInstanceResponse.result.result.appInstances as AppInstanceProposal[];
  }

  async getAppInstanceDetails(appInstanceId: string): Promise<AppInstanceJson> {
    let appInstance: any;
    try {
      const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: CFCoreTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
        parameters: { appInstanceId } as CFCoreTypes.GetAppInstanceDetailsParams,
      });
      appInstance = appInstanceResponse.result.result.appInstance;
    } catch (e) {
      if (e.message.includes("No multisig address exists for the given appInstanceId")) {
        logger.warn(`${e.message}: ${appInstanceId}`);
        appInstance = undefined;
      } else {
        throw e;
      }
    }
    logger.log(`getAppInstanceDetails called with result: ${JSON.stringify(appInstance)}`);
    return appInstance as AppInstanceJson;
  }

  async getAppState(appInstanceId: string): Promise<CFCoreTypes.GetStateResult | undefined> {
    // check the app is actually installed, or returned undefined
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      Logger.warn(err);
      return undefined;
    }
    const stateResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: CFCoreTypes.RpcMethodName.GET_STATE,
      parameters: {
        appInstanceId,
      } as CFCoreTypes.GetStateParams,
    });

    return stateResponse.result.result as CFCoreTypes.GetStateResult;
  }

  async getExpectedMultisigAddressFromUserXpub(userXpub: string): Promise<string> {
    const owners = [userXpub, this.cfCore.publicIdentifier];
    const addresses = await this.configService.getContractAddresses();
    const proxyFactory = addresses.ProxyFactory;
    const mVMultisig = addresses.MinimumViableMultisig;
    const ethProvider = this.configService.getEthProvider();
    return getCreate2MultisigAddress(owners, proxyFactory, mVMultisig, ethProvider);
  }

  /**
   * Returns value from `node_records` table stored at:
   * `{prefix}/{nodeXpub}/channel/{multisig}`
   */
  async getChannelRecord(multisig: string, prefix: string = ConnextNodeStorePrefix): Promise<any> {
    const path = `${prefix}/${this.cfCore.publicIdentifier}/channel/${multisig}`;
    return await this.cfCoreRepository.get(path);
  }

  private resolveInstallTransfer = (
    res: (value?: unknown) => void,
    message: InstallMessage,
  ): InstallMessage => {
    res(message);
    return message;
  };

  private rejectInstallTransfer = (
    rej: (reason?: string) => void,
    msg: RejectProposalMessage,
  ): any => {
    return rej(`Install failed. Event data: ${JSON.stringify(msg, replaceBN, 2)}`);
  };

  private cleanupInstallListeners = (boundReject: any, appId: string, userPubId: string): void => {
    this.messagingProvider.unsubscribe(`indra.client.${userPubId}.install.${appId}`);
    this.cfCore.off(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
  };

  private cleanupProposalListeners = (
    boundReject: any,
    multisigAddress: string,
    userPubId: string,
  ): void => {
    this.messagingProvider.unsubscribe(
      `indra.client.${userPubId}.proposalAccepted.${multisigAddress}`,
    );
    this.cfCore.off(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
  };

  private async appNotInstalled(appInstanceId: string): Promise<string | undefined> {
    const apps = await this.getAppInstances();
    const app = apps.filter((app: AppInstanceJson) => app.identityHash === appInstanceId);
    if (!app || app.length === 0) {
      return (
        `Could not find installed app with id: ${appInstanceId}. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    if (app.length > 1) {
      return (
        `CRITICAL ERROR: found multiple apps with the same id. ` +
        `Installed apps: ${JSON.stringify(apps, replaceBN, 2)}.`
      );
    }
    return undefined;
  }

  private async assertAppInstalled(appInstanceId: string): Promise<void> {
    const err = await this.appNotInstalled(appInstanceId);
    if (err) {
      throw new Error(err);
    }
  }

  registerCfCoreListener(
    event: CFCoreTypes.EventName,
    callback: (data: any) => any,
    context: string = "CFCoreService",
  ): void {
    Logger.log(`Registering cfCore callback for event ${event}`, context);
    this.cfCore.on(event, callback);
  }
}
