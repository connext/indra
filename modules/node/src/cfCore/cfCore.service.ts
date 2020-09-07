import { CFCore } from "@connext/cf-core";
import {
  DEFAULT_APP_TIMEOUT,
  WithdrawCommitment,
  AppRegistry as RegistryOfApps,
} from "@connext/apps";
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
  DefaultApp,
  Address,
  SupportedApplicationNames,
  AppRegistry,
  StoredAppChallengeStatus,
} from "@connext/types";
import {
  getSignerAddressFromPublicIdentifier,
  stringify,
  toBN,
  TypedEmitter,
} from "@connext/utils";
import { Inject, Injectable } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { BigNumber, constants } from "ethers";

import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { CFCoreProviderId, MessagingProviderId, TIMEOUT_BUFFER } from "../constants";
import { Channel } from "../channel/channel.entity";

import { CFCoreRecordRepository } from "./cfCore.repository";
import { ChannelSerializer } from "../channel/channel.repository";

const { Zero } = constants;

export const assertNoChallenges = (channel: Channel) => {
  if (!channel.challenges) {
    return;
  }
  const uncancelled = channel.challenges.filter(
    (c) => c.status !== StoredAppChallengeStatus.NO_CHALLENGE,
  );
  if (uncancelled.length > 0) {
    throw new Error(
      `Cannot interact with channel, channel has active challenges: ${stringify(
        channel.challenges,
      )}`,
    );
  }
};

@Injectable()
export class CFCoreService {
  private appRegistryMap: Map<string, DefaultApp> = new Map();
  public emitter: TypedEmitter;
  constructor(
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly log: LoggerService,
    private readonly configService: ConfigService,
    @Inject(CFCoreProviderId) public readonly cfCore: CFCore,
    private readonly cfCoreRepository: CFCoreRecordRepository,
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

  async createChannel(
    counterpartyIdentifier: string,
    chainId: number,
  ): Promise<MethodResults.CreateChannel> {
    const params = {
      id: Date.now(),
      methodName: MethodNames.chan_create,
      parameters: {
        owners: [this.cfCore.publicIdentifier, counterpartyIdentifier],
        chainId,
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
    channel: Channel,
  ): Promise<WithdrawCommitment> {
    assertNoChallenges(channel);
    const amount = toBN(params.amount);
    const { assetId, nonce, recipient } = params;
    const json = ChannelSerializer.toJSON(channel)!;
    const contractAddresses = this.configService.getContractAddresses(channel.chainId);
    const multisigOwners = [
      getSignerAddressFromPublicIdentifier(json.userIdentifiers[0]),
      getSignerAddressFromPublicIdentifier(json.userIdentifiers[1]),
    ];
    return new WithdrawCommitment(
      contractAddresses,
      channel.multisigAddress,
      multisigOwners,
      recipient!,
      assetId!,
      amount,
      nonce!,
    );
  }

  async proposeInstallApp(
    params: MethodParams.ProposeInstall,
    channel: Channel,
  ): Promise<MethodResults.ProposeInstall> {
    assertNoChallenges(channel);
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
    appInfo: DefaultApp,
    meta: object = {},
    stateTimeout: BigNumber = Zero,
  ): Promise<MethodResults.ProposeInstall | undefined> {
    assertNoChallenges(channel);
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

    let proposeRes: MethodResults.ProposeInstall;
    try {
      proposeRes = await this.proposeInstallApp(params, channel);
    } catch (err) {
      this.log.error(`Error proposing app ${err.message}. Params: ${JSON.stringify(params)}`);
      return undefined;
    }

    const raceRes: any = await Promise.race([
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

  async installApp(appIdentityHash: string, channel: Channel): Promise<MethodResults.Install> {
    assertNoChallenges(channel);
    const parameters: MethodParams.Install = {
      appIdentityHash,
      multisigAddress: channel.multisigAddress,
    };
    this.logCfCoreMethodStart(MethodNames.chan_install, parameters);
    const installRes = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_install,
      parameters,
    });
    this.logCfCoreMethodResult(MethodNames.chan_install, installRes.result.result);
    const installSubject = `${this.cfCore.publicIdentifier}.channel.${channel.multisigAddress}.app-instance.${appIdentityHash}.install`;
    await this.messagingService.publish(installSubject, installRes.result.result.appInstance);
    return installRes.result.result as MethodResults.Install;
  }

  async rejectInstallApp(
    appIdentityHash: string,
    channel: Channel,
    reason: string,
  ): Promise<MethodResults.RejectInstall> {
    assertNoChallenges(channel);
    const parameters: MethodParams.RejectInstall = {
      appIdentityHash,
      multisigAddress: channel.multisigAddress,
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
    channel: Channel,
    action: AppAction,
    stateTimeout?: BigNumber,
  ): Promise<MethodResults.TakeAction> {
    assertNoChallenges(channel);
    const parameters = {
      action,
      appIdentityHash,
      stateTimeout,
      multisigAddress: channel.multisigAddress,
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
    channel: Channel,
    action?: AppAction,
    protocolMeta?: any,
  ): Promise<MethodResults.Uninstall> {
    assertNoChallenges(channel);
    const parameters = {
      appIdentityHash,
      multisigAddress: channel.multisigAddress,
      action,
      protocolMeta,
    } as MethodParams.Uninstall;
    this.logCfCoreMethodStart(MethodNames.chan_uninstall, parameters);
    const uninstallResponse = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: MethodNames.chan_uninstall,
      parameters,
    });

    this.logCfCoreMethodResult(MethodNames.chan_uninstall, uninstallResponse.result.result);
    // TODO: this is only here for channelProvider, fix this eventually
    const uninstallSubject = `${this.cfCore.publicIdentifier}.channel.${channel.multisigAddress}.app-instance.${appIdentityHash}.uninstall`;
    await this.messagingService.publish(uninstallSubject, {
      ...uninstallResponse.result.result,
      protocolMeta,
    });
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
    let appInstance: AppInstanceJson | undefined;
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

  async getAppInstancesByAppDefinition(
    multisigAddress: Address,
    appDefinition: Address,
  ): Promise<AppInstanceJson[]> {
    const apps = await this.getAppInstances(multisigAddress);
    return apps.filter((app) => app.appDefinition === appDefinition);
  }

  async getAppInstancesByAppName(
    multisigAddress: Address,
    appName: SupportedApplicationNames,
  ): Promise<AppInstanceJson[]> {
    const { data: channel } = await this.getStateChannel(multisigAddress);
    const apps = await this.getAppInstances(multisigAddress);
    return apps.filter(
      (app) =>
        app.appDefinition ===
        this.getAppInfoByNameAndChain(appName, channel.chainId)!.appDefinitionAddress,
    );
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

  public getAppInfoByAppDefinitionAddress(appDefinition: string): DefaultApp {
    const app = this.appRegistryMap.get(appDefinition);
    if (!app) {
      throw new Error(`App info does not exist for appDefinition ${appDefinition}`);
    }
    return app;
  }

  public getAppInfoByNameAndChain(name: SupportedApplicationNames, chainId: number): DefaultApp {
    const app = this.appRegistryMap.get(`${name}:${chainId}`);
    if (!app) {
      throw new Error(`App info does not exist for name ${name} on chain ${chainId}`);
    }
    return app;
  }

  public getAppRegistry(chainId: number): AppRegistry {
    return Object.values(SupportedApplicationNames).map(
      (name) => this.getAppInfoByNameAndChain(name, chainId)!,
    );
  }

  async onModuleInit() {
    this.configService.getSupportedChains().forEach((chainId) => {
      const contractAddresses = this.configService.getContractAddresses(chainId);
      RegistryOfApps.forEach((app) => {
        const appDefinitionAddress = contractAddresses[app.name];
        this.log.info(`Creating ${app.name} app on chain ${chainId}: ${appDefinitionAddress}`);
        // set both name and app definition as keys for better lookup
        this.appRegistryMap.set(appDefinitionAddress, {
          actionEncoding: app.actionEncoding,
          appDefinitionAddress: appDefinitionAddress,
          name: app.name,
          chainId: chainId,
          outcomeType: app.outcomeType,
          stateEncoding: app.stateEncoding,
          allowNodeInstall: app.allowNodeInstall,
        } as DefaultApp);
        this.appRegistryMap.set(`${app.name}:${chainId}`, {
          actionEncoding: app.actionEncoding,
          appDefinitionAddress: appDefinitionAddress,
          name: app.name,
          chainId: chainId,
          outcomeType: app.outcomeType,
          stateEncoding: app.stateEncoding,
          allowNodeInstall: app.allowNodeInstall,
        } as DefaultApp);
      });
    });
  }

  async onApplicationShutdown(signal: string) {
    this.log.warn(`Disconnecting messaging service before app shutdown...`);
    await this.messagingService.disconnect();
    this.emitter.detach();
  }
}
