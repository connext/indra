import { generateValidationMiddleware } from "@connext/apps";
import { Node as CFCore } from "@connext/cf-core";
import {
  CFChannelProviderOptions,
  ChannelMethods,
  ChannelProviderConfig,
  ConditionalTransactionCommitmentJSON,
  ConnextEventEmitter,
  deBigNumberifyJson,
  EventNames,
  IChannelProvider,
  IChannelSigner,
  IClientStore,
  IRpcConnection,
  JsonRpcRequest,
  MethodName,
  MinimalTransaction,
  Opcode,
  SetStateCommitmentJSON,
  StateChannelJSON,
  toBN,
  WalletDepositParams,
  WithdrawalMonitorObject,
} from "@connext/types";
import { ChannelProvider } from "@connext/channel-provider";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";
import { getPublicKeyFromPublicIdentifier } from "@connext/crypto";

export const createCFChannelProvider = async ({
  ethProvider,
  lockService,
  logger,
  messaging,
  contractAddresses,
  nodeConfig,
  nodeUrl,
  signer,
  store,
}: CFChannelProviderOptions): Promise<IChannelProvider> => {
  const cfCore = await CFCore.create(
    messaging,
    store,
    contractAddresses,
    nodeConfig,
    ethProvider,
    signer,
    lockService,
    undefined,
    logger,
  );

  // register any default middlewares
  cfCore.injectMiddleware(
    Opcode.OP_VALIDATE,
    await generateValidationMiddleware(contractAddresses),
  );

  const channelProviderConfig: ChannelProviderConfig = {
    signerAddress: signer.address,
    nodeUrl,
    userIdentifier: signer.publicIdentifier,
  };
  const connection = new CFCoreRpcConnection(cfCore, store, signer, channelProviderConfig);
  const channelProvider = new ChannelProvider(connection);
  return channelProvider;
};

export class CFCoreRpcConnection extends ConnextEventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;
  public store: IClientStore;
  public config: ChannelProviderConfig;
  public multisigAddress: string | undefined;

  public signer: IChannelSigner;

  constructor(
    cfCore: CFCore,
    store: IClientStore,
    signer: IChannelSigner,
    config: ChannelProviderConfig,
  ) {
    super();
    this.cfCore = cfCore;
    this.signer = signer;
    this.store = store;
    this.config = config;
    this.multisigAddress = this.config.multisigAddress;
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const { method, params } = payload;
    let result;
    switch (method) {
      case ChannelMethods.chan_setUserWithdrawal:
        result = await this.setUserWithdrawal(params.withdrawalObject);
        break;
      case ChannelMethods.chan_getUserWithdrawal:
        result = await this.getUserWithdrawal();
        break;
      case ChannelMethods.chan_signMessage:
        result = await this.signMessage(params.message);
        break;
      case ChannelMethods.chan_encrypt:
        result = await this.encrypt(params.message, params.publicIdentifier);
        break;
      case ChannelMethods.chan_config:
        result = await this.getConfig();
        break;
      case ChannelMethods.chan_restoreState:
        result = await this.restoreState();
        break;
      case ChannelMethods.chan_setStateChannel:
        result = await this.setStateChannel(params.state);
        break;
      case ChannelMethods.chan_walletDeposit:
        result = await this.walletDeposit(params);
        break;
      case ChannelMethods.chan_createSetupCommitment:
        result = await this.createSetupCommitment(params.multisigAddress, params.commitment);
        break;
      case ChannelMethods.chan_createSetStateCommitment:
        result = await this.createSetStateCommitment(params.appIdentityHash, params.commitment);
        break;
      case ChannelMethods.chan_createConditionalCommitment:
        result = await this.createConditionalCommitment(params.appIdentityHash, params.commitment);
        break;
      default:
        result = await this.routerDispatch(method, params);
        break;
    }
    return result;
  }

  public on = (
    event: string | EventNames | MethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.on(event as any, listener);
    return this.cfCore;
  };

  public once = (
    event: string | EventNames | MethodName,
    listener: (...args: any[]) => void,
  ): any => {
    this.cfCore.once(event as any, listener);
    return this.cfCore;
  };

  public open(): Promise<void> {
    return Promise.resolve();
  }

  public close(): Promise<void> {
    return Promise.resolve();
  }

  ///////////////////////////////////////////////
  ///// PRIVATE METHODS

  private signMessage(message: string): Promise<string> {
    return this.signer.signMessage(message);
  }

  private encrypt(message: string, publicIdentifier: string): Promise<string> {
    return this.signer.encrypt(message, getPublicKeyFromPublicIdentifier(publicIdentifier));
  }

  private walletDeposit = async (params: WalletDepositParams): Promise<string> => {
    let hash;
    const multisigAddress = await this.getMultisigAddress();
    if (!multisigAddress) {
      throw new Error("Cannot make wallet deposit without multisigAddress");
    }
    if (params.assetId === AddressZero) {
      const tx = await this.signer.sendTransaction({
        to: multisigAddress,
        value: toBN(params.amount),
      });
      hash = tx.hash;
    } else {
      const erc20 = new Contract(params.assetId, tokenAbi, this.signer);
      const tx = await erc20.transfer(multisigAddress, toBN(params.amount));
      hash = tx.hash;
    }
    return hash;
  };

  private getUserWithdrawal = async (): Promise<WithdrawalMonitorObject | undefined> => {
    return this.store.getUserWithdrawal();
  };

  private setUserWithdrawal = async (value: WithdrawalMonitorObject | undefined): Promise<void> => {
    if (!value) {
      return this.store.removeUserWithdrawal();
    }
    const existing = await this.store.getUserWithdrawal();
    if (!existing) {
      return this.store.createUserWithdrawal(value);
    }
    return this.store.updateUserWithdrawal(value);
  };

  private setStateChannel = async (channel: StateChannelJSON): Promise<void> => {
    return this.store.createStateChannel(channel);
  };

  private restoreState = async (): Promise<void> => {
    await this.store.restore();
  };

  public createSetupCommitment = async (
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<void> => {
    await this.store.createSetupCommitment(multisigAddress, commitment);
    // may be called on restore, if this is ever called assume the schema
    // should be updated (either on start or restart)
    await this.store.updateSchemaVersion();
  };

  public createSetStateCommitment = async (
    appIdentityHash: string,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> => {
    await this.store.createSetStateCommitment(appIdentityHash, commitment);
  };

  public createConditionalCommitment = async (
    appIdentityHash: string,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<void> => {
    await this.store.createConditionalTransactionCommitment(appIdentityHash, commitment);
  };

  private async getConfig(): Promise<ChannelProviderConfig> {
    if (this.config) {
      return this.config;
    }
    this.config = await this.routerDispatch(ChannelMethods.chan_config);
    return this.config;
  }

  private async getMultisigAddress(): Promise<string | undefined> {
    if (this.multisigAddress) {
      return this.multisigAddress;
    }
    const config = await this.getConfig();
    if (config.multisigAddress) {
      this.multisigAddress = this.config.multisigAddress;
      return this.multisigAddress;
    }
    return undefined;
  }

  private routerDispatch = async (method: string, params: any = {}) => {
    const ret = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: method,
      parameters: deBigNumberifyJson(params),
    });
    return ret.result.result;
  };
}
