import { CFCore } from "@connext/cf-core";
import { DEFAULT_APP_TIMEOUT, WithdrawCommitment } from "@connext/apps";
import {
  AppAction,
  AppInstanceJson,
  AssetId,
  ConnextNodeStorePrefix,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  MethodNames,
  MethodParams,
  MethodResults,
  PublicParams,
  StateChannelJSON,
  EventName,
  CF_METHOD_TIMEOUT,
  ProtocolEventMessage,
  SupportedApplicationNames,
} from "@connext/types";
import {
  getSignerAddressFromPublicIdentifier,
  stringify,
  toBN,
  TypedEmitter,
} from "@connext/utils";
import { Inject, Injectable } from "@nestjs/common";
import { BigNumber, constants } from "ethers";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { CFCoreProviderId, MessagingProviderId, TIMEOUT_BUFFER } from "../constants";
import { Channel } from "../channel/channel.entity";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { MessagingService } from "@connext/messaging";

const { Zero } = constants;

Injectable();
export class CFCoreService {
  public emitter: TypedEmitter;
  constructor(
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly log: LoggerService,
    private readonly configService: ConfigService,
    @Inject(CFCoreProviderId) public readonly cfCore: CFCore,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.emitter = new TypedEmitter();
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
    const amount = toBN(params.amount);
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
    const network = await this.configService.getEthNetwork();

    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(app, network.chainId);

    // Decrement timeout so that receiver app MUST finalize before sender app
    // See: https://github.com/connext/indra/issues/1046
    const timeout = DEFAULT_APP_TIMEOUT.sub(TIMEOUT_BUFFER);

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
      defaultTimeout: timeout,
      stateTimeout,
    };
    this.log.info(`Attempting to install ${appInfo.name} in channel ${channel.multisigAddress}`);

    let proposeRes;
    try {
      proposeRes = await this.proposeInstallApp(params);
    } catch (err) {
      this.log.error(`Error installing app, proposal failed. Params: ${JSON.stringify(params)}`);
      return undefined;
    }

    const raceRes = await Promise.race([
      new Promise(async (resolve, reject) => {
        try {
          await this.emitter.waitFor(
            EventNames.INSTALL_EVENT,
            CF_METHOD_TIMEOUT * 3,
            (msg) => msg.appIdentityHash === proposeRes.appIdentityHash,
          );
          resolve(undefined);
        } catch (e) {
          reject(new Error(e.message));
        }
      }),
      this.emitter.waitFor(
        EventNames.INSTALL_FAILED_EVENT,
        CF_METHOD_TIMEOUT * 3,
        (msg) => msg.params.proposal.identityHash === proposeRes.appIdentityHash,
      ),
      this.emitter.waitFor(
        EventNames.REJECT_INSTALL_EVENT,
        CF_METHOD_TIMEOUT * 3,
        (msg) => msg.appInstance.identityHash === proposeRes.appIdentityHash,
      ),
    ]);
    if (raceRes) {
      this.log.error(
        `Error installing app: ${
          raceRes["error"] ? raceRes["error"] : "proposal rejected by client"
        }.`,
      );
      return undefined;
    }
    return proposeRes as MethodResults.ProposeInstall;
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
    const installSubject = `${this.cfCore.publicIdentifier}.channel.${multisigAddress}.app-instance.${appIdentityHash}.install`;
    await this.messagingService.publish(installSubject, installRes.result.result.appInstance);
    return installRes.result.result as MethodResults.Install;
  }

  async rejectInstallApp(
    appIdentityHash: string,
    multisigAddress: string,
    reason: string,
  ): Promise<MethodResults.RejectInstall> {
    const parameters: MethodParams.RejectInstall = {
      appIdentityHash,
      multisigAddress,
      reason,
    };
    this.logCfCoreMethodStart(MethodNames.chan_rejectInstall, parameters);
    const rejectRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_rejectInstall,
      parameters,
    });
    this.logCfCoreMethodResult(MethodNames.chan_rejectInstall, rejectRes.result.result);
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
    action?: AppAction,
  ): Promise<MethodResults.Uninstall> {
    const parameters = {
      appIdentityHash,
      multisigAddress,
      action,
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

  async getProposedAppInstances(multisigAddress?: string): Promise<AppInstanceJson[]> {
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
    return appInstanceResponse.result.result.appInstances as AppInstanceJson[];
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
    appName: SupportedApplicationNames,
  ): Promise<AppInstanceJson[]> {
    const network = await this.configService.getEthNetwork();
    const appRegistry = await this.appRegistryRepository.findByNameAndNetwork(
      appName,
      network.chainId,
    );
    const apps = await this.getAppInstances(multisigAddress);
    return apps.filter((app) => app.appDefinition === appRegistry.appDefinitionAddress);
  }

  /**
   * Returns value from `node_records` table stored at:
   * `{prefix}/{nodeAddress}/channel/{multisig}`
   */
  async getChannelRecord(multisig: string, prefix: string = ConnextNodeStorePrefix): Promise<any> {
    const path = `${prefix}/${this.cfCore.publicIdentifier}/channel/${multisig}`;
    return this.cfCoreRepository.get(path);
  }

  registerCfCoreListener<T extends EventName>(
    event: T,
    callback: (data: ProtocolEventMessage<T>) => void | Promise<void>,
  ): void {
    this.log.info(`Registering cfCore callback for event ${event}`);
    this.cfCore.on(event, (data: ProtocolEventMessage<any>) => {
      // parrot event with typed emitter
      this.emitter.post(event, data.data);
      return callback(data);
    });
  }
}
