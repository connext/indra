import { MessagingService } from "@connext/messaging";
import { SupportedApplications, WithdrawCommitment } from "@connext/apps";
import {
  AppAction,
  ConnextNodeStorePrefix,
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
  StateChannelJSON,
  stringify,
  toBN,
  WithdrawParameters,
} from "@connext/types";
import { Inject, Injectable } from "@nestjs/common";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { CFCoreProviderId, MessagingProviderId } from "../constants";
import {
  AppInstanceJson,
  AppInstanceProposal,
  CFCore,
  InstallMessage,
  RejectProposalMessage,
  xkeyKthAddress,
} from "../util";
import { ChannelRepository } from "../channel/channel.repository";
import { Channel } from "../channel/channel.entity";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

Injectable();
export class CFCoreService {
  constructor(
    @Inject(CFCoreProviderId) public readonly cfCore: CFCore,
    private readonly configService: ConfigService,
    @Inject(MessagingProviderId) private readonly messagingProvider: MessagingService,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly log: LoggerService,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.cfCore = cfCore;
    this.log.setContext("CFCoreService");
  }

  async getFreeBalance(
    userPubId: string,
    multisigAddress: string,
    assetId: string = AddressZero,
  ): Promise<MethodResults.GetFreeBalanceState> {
    try {
      const freeBalance = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: MethodNames.chan_getFreeBalanceState,
        parameters: {
          multisigAddress,
          tokenAddress: assetId,
        },
      });
      return freeBalance.result.result as MethodResults.GetFreeBalanceState;
    } catch (e) {
      const error = `No free balance exists for the specified token: ${assetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the free balance address in the multisig
        const obj = {};
        obj[this.cfCore.freeBalanceAddress] = Zero;
        obj[xkeyKthAddress(userPubId)] = Zero;
        return obj;
      }
      this.log.error(e.message, e.stack);
      throw e;
    }
  }

  async getStateChannel(multisigAddress: string): Promise<{ data: StateChannelJSON }> {
    const params = {
      id: Date.now(),
      methodName: MethodNames.chan_getStateChannel,
      parameters: {
        multisigAddress,
      },
    };
    const getStateChannelRes = await this.cfCore.rpcRouter.dispatch(params);
    return getStateChannelRes.result.result;
  }

  async createChannel(counterpartyPublicIdentifier: string): Promise<MethodResults.CreateChannel> {
    const params = {
      id: Date.now(),
      methodName: MethodNames.chan_create,
      parameters: {
        owners: [this.cfCore.publicIdentifier, counterpartyPublicIdentifier],
      } as MethodParams.CreateChannel,
    };
    this.log.debug(`Calling createChannel with params: ${stringify(params)}`);
    const createRes = await this.cfCore.rpcRouter.dispatch(params);
    this.log.debug(`createChannel called with result: ${stringify(createRes.result.result)}`);
    return createRes.result.result as MethodResults.CreateChannel;
  }

  async deployMultisig(multisigAddress: string): Promise<MethodResults.DeployStateDepositHolder> {
    const params = {
      id: Date.now(),
      methodName: MethodNames.chan_deployStateDepositHolder,
      parameters: {
        multisigAddress,
      } as MethodParams.DeployStateDepositHolder,
    };
    this.log.debug(
      `Calling ${MethodNames.chan_deployStateDepositHolder} with params: ${stringify(params)}`,
    );
    const deployRes = await this.cfCore.rpcRouter.dispatch(params);
    this.log.debug(
      `${MethodNames.chan_deployStateDepositHolder} called with result: ${stringify(
        deployRes.result.result,
      )}`,
    );
    return deployRes.result.result as MethodResults.DeployStateDepositHolder;
  }

  async createWithdrawCommitment(
    params: WithdrawParameters,
    multisigAddress: string,
  ): Promise<WithdrawCommitment> {
    const amount = toBN(params.amount);
    const { assetId, recipient } = params;
    const channel = await this.getStateChannel(multisigAddress);
    const contractAddresses = await this.configService.getContractAddresses(
      (await this.configService.getEthNetwork()).chainId.toString(),
    );
    return new WithdrawCommitment(
      contractAddresses,
      channel.data.multisigAddress,
      channel.data.freeBalanceAppInstance.participants,
      recipient,
      assetId,
      amount,
    );
  }

  async proposeInstallApp(
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> {
    this.log.debug(`Calling ${MethodNames.chan_proposeInstall} with params: ${stringify(params)}`);
    const proposeRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_proposeInstall,
      parameters: params,
    });
    this.log.debug(`proposeInstallApp called with result ${stringify(proposeRes.result.result)}`);
    return proposeRes.result.result as MethodResults.ProposeInstall;
  }

  async proposeAndWaitForInstallApp(
    channel: Channel,
    initialState: any,
    initiatorDeposit: BigNumber,
    initiatorDepositTokenAddress: string,
    responderDeposit: BigNumber,
    responderDepositTokenAddress: string,
    app: string,
    meta: object = {},
  ): Promise<MethodResults.ProposeInstall | undefined> {
    let boundReject: (reason?: any) => void;
    let boundResolve: (reason?: any) => void;

    const network = await this.configService.getEthNetwork();

    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(app, network.chainId);

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = appInfo;
    const params: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit,
      initiatorDepositTokenAddress,
      meta,
      outcomeType,
      proposedToIdentifier: channel.userPublicIdentifier,
      responderDeposit,
      responderDepositTokenAddress,
      timeout: Zero,
    };

    let proposeRes: MethodResults.ProposeInstall;
    try {
      await new Promise(
        async (res: () => any, rej: (msg: string) => any): Promise<void> => {
          proposeRes = await this.proposeInstallApp(params);
          boundResolve = this.resolveInstallTransfer.bind(null, res, proposeRes.appInstanceId);
          boundReject = this.rejectInstallTransfer.bind(null, rej);
          this.cfCore.on(EventNames.INSTALL_EVENT, boundResolve);
          this.cfCore.on(EventNames.REJECT_INSTALL_EVENT, boundReject);
        },
      );
      this.log.info(`App was installed successfully: ${proposeRes.appInstanceId}`);
      this.log.debug(`App install result: ${stringify(proposeRes)}`);
      return proposeRes;
    } catch (e) {
      this.log.error(`Error installing app: ${e.message}`, e.stack);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, boundResolve);
    }
  }

  async installApp(appInstanceId: string): Promise<MethodResults.Install> {
    const installRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_install,
      parameters: {
        appInstanceId,
      } as MethodParams.Install,
    });
    this.log.info(`installApp succeeded for app ${appInstanceId}`);
    this.log.debug(`installApp result: ${stringify(installRes.result.result)}`);
    return installRes.result.result as MethodResults.Install;
  }

  async rejectInstallApp(appInstanceId: string): Promise<MethodResults.RejectInstall> {
    const rejectRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_rejectInstall,
      parameters: {
        appInstanceId,
      } as MethodParams.RejectInstall,
    });
    this.log.info(`rejectInstallApp succeeded for app ${appInstanceId}`);
    this.log.debug(`rejectInstallApp result: ${stringify(rejectRes.result.result)}`);
    // update app status
    const rejectedApp = await this.appInstanceRepository.findByIdentityHash(appInstanceId);
    if (!rejectedApp) {
      throw new Error(`No app found after being rejected for app ${appInstanceId}`);
    }
    rejectedApp.type = AppType.REJECTED;
    await this.appInstanceRepository.save(rejectedApp);
    return rejectRes.result.result as MethodResults.RejectInstall;
  }

  async takeAction(appInstanceId: string, action: AppAction): Promise<MethodResults.TakeAction> {
    const actionResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_takeAction,
      parameters: {
        action,
        appInstanceId,
      } as MethodParams.TakeAction,
    });

    this.log.info(`takeAction succeeded for app ${appInstanceId}`);
    this.log.debug(`takeAction result: ${stringify(actionResponse.result)}`);
    return actionResponse.result.result as MethodResults.TakeAction;
  }

  async uninstallApp(appInstanceId: string): Promise<MethodResults.Uninstall> {
    this.log.info(`Calling uninstallApp for appInstanceId ${appInstanceId}`);
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_uninstall,
      parameters: {
        appInstanceId,
      },
    });

    this.log.info(`uninstallApp succeeded for app ${appInstanceId}`);
    this.log.debug(`uninstallApp result: ${stringify(uninstallResponse.result.result)}`);
    return uninstallResponse.result.result as MethodResults.Uninstall;
  }

  async getAppInstances(multisigAddress: string): Promise<AppInstanceJson[]> {
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getAppInstances,
      parameters: {
        multisigAddress,
      } as MethodParams.GetAppInstances,
    });

    /*
    this.log.debug(
      `getAppInstances called with result ${stringify(appInstanceResponse.result.result)}`,
    );
    */
    return appInstanceResponse.result.result.appInstances as AppInstanceJson[];
  }

  async getProposedAppInstances(multisigAddress?: string): Promise<AppInstanceProposal[]> {
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getProposedAppInstances,
      parameters: { multisigAddress } as MethodParams.GetAppInstances,
    });

    this.log.info(`Got proposed app instances for multisig ${multisigAddress}`);
    this.log.debug(
      `getProposedAppInstances result: ${stringify(appInstanceResponse.result.result)}`,
    );
    return appInstanceResponse.result.result.appInstances as AppInstanceProposal[];
  }

  async getAppInstanceDetails(appInstanceId: string): Promise<AppInstanceJson> {
    let appInstance: any;
    try {
      const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: MethodNames.chan_getAppInstance,
        parameters: { appInstanceId } as MethodParams.GetAppInstanceDetails,
      });
      appInstance = appInstanceResponse.result.result.appInstance;
    } catch (e) {
      if (e.message.includes(`No multisig address exists for the given appInstanceId`)) {
        this.log.warn(`${e.message}: ${appInstanceId}`);
        appInstance = undefined;
      } else {
        throw e;
      }
    }
    this.log.info(`Got app instance details for app ${appInstanceId}`);
    this.log.debug(`getAppInstanceDetails result: ${stringify(appInstance)}`);
    return appInstance as AppInstanceJson;
  }

  async getAppState(appInstanceId: string): Promise<MethodResults.GetState | undefined> {
    const stateResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getState,
      parameters: {
        appInstanceId,
      } as MethodParams.GetState,
    });
    this.log.info(`Got state for app ${appInstanceId}`);
    this.log.debug(`getAppState result: ${stringify(stateResponse)}`);
    return stateResponse.result.result as MethodResults.GetState;
  }

  async getAppInstancesByAppName(
    multisigAddress: string,
    appName: SupportedApplications,
  ): Promise<AppInstanceJson[]> {
    const network = await this.configService.getEthNetwork();
    const appRegistry = await this.appRegistryRepository.findByNameAndNetwork(
      appName,
      network.chainId,
    );
    const apps = await this.getAppInstances(multisigAddress);
    return apps.filter(app => app.appInterface.addr === appRegistry.appDefinitionAddress);
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
    appInstanceId: string,
    message: InstallMessage,
  ): InstallMessage => {
    if (appInstanceId === message.data.params.appInstanceId) {
      res(message);
    }
    return message;
  };

  private rejectInstallTransfer = (
    rej: (reason?: string) => void,
    msg: RejectProposalMessage,
  ): any => {
    return rej(`Install failed. Event data: ${stringify(msg)}`);
  };

  private cleanupInstallListeners = (boundReject: any, boundResolve: any): void => {
    this.cfCore.off(EventNames.INSTALL_EVENT, boundResolve);
    this.cfCore.off(EventNames.REJECT_INSTALL_EVENT, boundReject);
  };

  registerCfCoreListener(event: EventNames, callback: (data: any) => any): void {
    this.log.info(`Registering cfCore callback for event ${event}`);
    this.cfCore.on(event, callback);
  }
}
