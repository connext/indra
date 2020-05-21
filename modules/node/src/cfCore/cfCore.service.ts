import { Node as CFCore } from "@connext/cf-core";
import { DEFAULT_APP_TIMEOUT, SupportedApplications, WithdrawCommitment } from "@connext/apps";
import {
  AppAction,
  AppInstanceJson,
  AppInstanceProposal,
  AssetId,
  ConnextNodeStorePrefix,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  InstallMessage,
  MethodNames,
  MethodParams,
  MethodResults,
  PublicParams,
  RejectProposalMessage,
  StateChannelJSON,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Inject, Injectable } from "@nestjs/common";
import { BigNumber, constants } from "ethers";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { CFCoreProviderId } from "../constants";
import { Channel } from "../channel/channel.entity";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

const { Zero } = constants;

Injectable();
export class CFCoreService {
  constructor(
    @Inject(CFCoreProviderId) public readonly cfCore: CFCore,
    private readonly log: LoggerService,
    private readonly configService: ConfigService,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.cfCore = cfCore;
    this.log.setContext("CFCoreService");
  }

  private logCfCoreMethodStart<T = any>(name: string, params: T): void {
    this.log.debug(`Calling cfCore RPC method ${name} with params: ${stringify(params)}`);
  }

  private logCfCoreMethodResult<T = any>(name: string, result: T): void {
    this.log.debug(`${name} called with result: ${stringify(result)}`);
  }

  async getFreeBalance(
    userPubId: string,
    multisigAddress: string,
    assetId?: string,
  ): Promise<MethodResults.GetFreeBalanceState> {
    try {
      const parameters: MethodParams.GetFreeBalanceState = {
        multisigAddress,
        assetId: assetId || CONVENTION_FOR_ETH_ASSET_ID,
      };
      this.logCfCoreMethodStart(MethodNames.chan_getFreeBalanceState, parameters);
      const freeBalance = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: MethodNames.chan_getFreeBalanceState,
        parameters,
      });
      this.logCfCoreMethodResult(MethodNames.chan_getFreeBalanceState, freeBalance.result.result);
      return freeBalance.result.result as MethodResults.GetFreeBalanceState;
    } catch (e) {
      const error = `No free balance exists for the specified token: ${assetId}`;
      if (e.message.includes(error)) {
        // if there is no balance, return undefined
        // NOTE: can return free balance obj with 0s,
        // but need the free balance address in the multisig
        const obj = {};
        obj[this.cfCore.signerAddress] = Zero;
        obj[getSignerAddressFromPublicIdentifier(userPubId)] = Zero;
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
    this.logCfCoreMethodStart(MethodNames.chan_getStateChannel, params.parameters);

    const getStateChannelRes = await this.cfCore.rpcRouter.dispatch(params);
    this.logCfCoreMethodResult(MethodNames.chan_getStateChannel, getStateChannelRes.result.result);
    return getStateChannelRes.result.result;
  }

  async createChannel(counterpartyIdentifier: string): Promise<MethodResults.CreateChannel> {
    const params = {
      id: Date.now(),
      methodName: MethodNames.chan_create,
      parameters: {
        owners: [this.cfCore.publicIdentifier, counterpartyIdentifier],
      } as MethodParams.CreateChannel,
    };
    this.logCfCoreMethodStart(MethodNames.chan_create, params.parameters);
    const createRes = await this.cfCore.rpcRouter.dispatch(params);
    this.logCfCoreMethodResult(MethodNames.chan_create, createRes.result.result);
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
    this.logCfCoreMethodStart(MethodNames.chan_deployStateDepositHolder, params.parameters);
    const deployRes = await this.cfCore.rpcRouter.dispatch(params);
    this.logCfCoreMethodResult(MethodNames.chan_deployStateDepositHolder, deployRes.result.result);
    return deployRes.result.result as MethodResults.DeployStateDepositHolder;
  }

  async createWithdrawCommitment(
    params: PublicParams.Withdraw,
    multisigAddress: string,
  ): Promise<WithdrawCommitment> {
    const amount = BigNumber.from(params.amount);
    const { assetId, nonce, recipient } = params;
    const { data: channel } = await this.getStateChannel(multisigAddress);
    const contractAddresses = await this.configService.getContractAddresses(
      (await this.configService.getEthNetwork()).chainId.toString(),
    );
    const multisigOwners = [
      getSignerAddressFromPublicIdentifier(channel.userIdentifiers[0]),
      getSignerAddressFromPublicIdentifier(channel.userIdentifiers[1]),
    ];
    return new WithdrawCommitment(
      contractAddresses,
      channel.multisigAddress,
      multisigOwners,
      recipient,
      assetId,
      amount,
      nonce,
    );
  }

  async proposeInstallApp(
    params: MethodParams.ProposeInstall,
  ): Promise<MethodResults.ProposeInstall> {
    this.logCfCoreMethodStart(MethodNames.chan_proposeInstall, params);
    const proposeRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_proposeInstall,
      parameters: params,
    });
    this.logCfCoreMethodResult(MethodNames.chan_proposeInstall, proposeRes.result.result);
    return proposeRes.result.result as MethodResults.ProposeInstall;
  }

  async proposeAndWaitForInstallApp(
    channel: Channel,
    initialState: any,
    initiatorDeposit: BigNumber,
    initiatorDepositAssetId: AssetId,
    responderDeposit: BigNumber,
    responderDepositAssetId: AssetId,
    app: string,
    meta: object = {},
    stateTimeout: BigNumber = Zero,
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
      initiatorDepositAssetId,
      meta,
      multisigAddress: channel.multisigAddress,
      outcomeType,
      responderIdentifier: channel.userIdentifier,
      responderDeposit,
      responderDepositAssetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout,
    };
    this.log.info(`Attempting to install ${appInfo.name} in channel ${channel.multisigAddress}`);

    let proposeRes: MethodResults.ProposeInstall;
    try {
      await new Promise(
        async (res: () => any, rej: (msg: string) => any): Promise<void> => {
          proposeRes = await this.proposeInstallApp(params);
          boundResolve = this.resolveInstallTransfer.bind(null, res, proposeRes.appIdentityHash);
          boundReject = this.rejectInstallTransfer.bind(null, rej);
          this.cfCore.on(EventNames.INSTALL_EVENT, boundResolve);
          this.cfCore.on(EventNames.REJECT_INSTALL_EVENT, boundReject);
        },
      );
      this.log.info(
        `App ${appInfo.name} was installed successfully: ${proposeRes.appIdentityHash}`,
      );
      this.log.debug(`App install result: ${stringify(proposeRes)}`);
      return proposeRes;
    } catch (e) {
      this.log.error(`Error installing app: ${e}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, boundResolve);
    }
  }

  async installApp(
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<MethodResults.Install> {
    const parameters: MethodParams.Install = {
      appIdentityHash,
      multisigAddress,
    };
    this.logCfCoreMethodStart(MethodNames.chan_install, parameters);
    const installRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_install,
      parameters,
    });
    this.logCfCoreMethodResult(MethodNames.chan_install, installRes.result.result);
    return installRes.result.result as MethodResults.Install;
  }

  async rejectInstallApp(
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<MethodResults.RejectInstall> {
    const parameters: MethodParams.RejectInstall = {
      appIdentityHash,
      multisigAddress,
    };
    this.logCfCoreMethodStart(MethodNames.chan_rejectInstall, parameters);
    const rejectRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_rejectInstall,
      parameters,
    });
    this.logCfCoreMethodResult(MethodNames.chan_rejectInstall, rejectRes.result.result);
    // update app status
    const rejectedApp = await this.appInstanceRepository.findByIdentityHash(appIdentityHash);
    if (!rejectedApp) {
      throw new Error(`No app found after being rejected for app ${appIdentityHash}`);
    }
    rejectedApp.type = AppType.REJECTED;
    await this.appInstanceRepository.save(rejectedApp);
    return rejectRes.result.result as MethodResults.RejectInstall;
  }

  async takeAction(
    appIdentityHash: string,
    multisigAddress: string,
    action: AppAction,
    stateTimeout?: BigNumber,
  ): Promise<MethodResults.TakeAction> {
    const parameters = {
      action,
      appIdentityHash,
      stateTimeout,
      multisigAddress,
    } as MethodParams.TakeAction;
    this.logCfCoreMethodStart(MethodNames.chan_takeAction, parameters);

    const actionResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_takeAction,
      parameters,
    });

    this.logCfCoreMethodResult(MethodNames.chan_takeAction, actionResponse.result.result);
    return actionResponse.result.result as MethodResults.TakeAction;
  }

  async uninstallApp(
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<MethodResults.Uninstall> {
    const parameters = {
      appIdentityHash,
      multisigAddress,
    } as MethodParams.Uninstall;
    this.logCfCoreMethodStart(MethodNames.chan_uninstall, parameters);
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_uninstall,
      parameters,
    });

    this.logCfCoreMethodResult(MethodNames.chan_uninstall, uninstallResponse.result.result);
    return uninstallResponse.result.result as MethodResults.Uninstall;
  }

  async getAppInstances(multisigAddress: string): Promise<AppInstanceJson[]> {
    const parameters = {
      multisigAddress,
    } as MethodParams.GetAppInstances;
    this.logCfCoreMethodStart(MethodNames.chan_getAppInstances, parameters);

    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getAppInstances,
      parameters,
    });

    this.logCfCoreMethodResult(MethodNames.chan_getAppInstances, appInstanceResponse.result.result);
    return appInstanceResponse.result.result.appInstances as AppInstanceJson[];
  }

  async getProposedAppInstances(multisigAddress?: string): Promise<AppInstanceProposal[]> {
    const parameters = {
      multisigAddress,
    } as MethodParams.GetProposedAppInstances;
    this.logCfCoreMethodStart(MethodNames.chan_getProposedAppInstances, parameters);
    const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_getProposedAppInstances,
      parameters,
    });

    this.logCfCoreMethodResult(
      MethodNames.chan_getProposedAppInstances,
      appInstanceResponse.result.result,
    );
    return appInstanceResponse.result.result.appInstances as AppInstanceProposal[];
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson> {
    const parameters = {
      appIdentityHash,
    } as MethodParams.GetAppInstanceDetails;
    let appInstance: AppInstanceJson;
    try {
      this.logCfCoreMethodStart(MethodNames.chan_getAppInstance, parameters);
      const appInstanceResponse = await this.cfCore.rpcRouter.dispatch({
        id: Date.now(),
        methodName: MethodNames.chan_getAppInstance,
        parameters: { appIdentityHash } as MethodParams.GetAppInstanceDetails,
      });
      this.logCfCoreMethodResult(
        MethodNames.chan_getAppInstance,
        appInstanceResponse.result.result,
      );
      appInstance = appInstanceResponse.result.result.appInstance;
    } catch (e) {
      if (e.message.includes(`No multisig address exists for the given appIdentityHash`)) {
        this.log.warn(`${e.message}: ${appIdentityHash}`);
        appInstance = undefined;
      } else {
        throw e;
      }
    }
    return appInstance as AppInstanceJson;
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
    return apps.filter((app) => app.appInterface.addr === appRegistry.appDefinitionAddress);
  }

  /**
   * Returns value from `node_records` table stored at:
   * `{prefix}/{nodeAddress}/channel/{multisig}`
   */
  async getChannelRecord(multisig: string, prefix: string = ConnextNodeStorePrefix): Promise<any> {
    const path = `${prefix}/${this.cfCore.publicIdentifier}/channel/${multisig}`;
    return this.cfCoreRepository.get(path);
  }

  private resolveInstallTransfer = (
    res: (value?: unknown) => void,
    appIdentityHash: string,
    message: InstallMessage,
  ): InstallMessage => {
    if (appIdentityHash === message.data.params.appIdentityHash) {
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
