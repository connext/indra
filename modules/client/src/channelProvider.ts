import { generateValidationMiddleware } from "@connext/apps";
import { ChannelProvider } from "@connext/channel-provider";
import { Node as CFCore } from "@connext/cf-core";
import {
  CFChannelProviderOptions,
  ChannelMethods,
  ChannelProviderConfig,
  ConditionalTransactionCommitmentJSON,
  ConnextEventEmitter,
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
  WalletDepositParams,
  WithdrawalMonitorObject,
  CreateChannelMessage,
} from "@connext/types";
import { deBigNumberifyJson, toBN } from "@connext/utils";
import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";
import { getPublicKeyFromPublicIdentifier } from "@connext/utils";

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

  const connection = new CFCoreRpcConnection(cfCore, store, signer, nodeUrl);
  const channelProvider = new ChannelProvider(connection);
  await channelProvider.enable();
  return channelProvider;
};

export class CFCoreRpcConnection extends ConnextEventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;
  public store: IClientStore;

  private signer: IChannelSigner;
  private config: ChannelProviderConfig;

  constructor(cfCore: CFCore, store: IClientStore, signer: IChannelSigner, nodeUrl: string) {
    super();
    this.cfCore = cfCore;
    this.signer = signer;
    this.store = store;
    this.config = {
      nodeUrl,
      signerAddress: signer.address,
      userIdentifier: signer.publicIdentifier,
    };
    this.subscribeChannelCreation();
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const { method, params } = payload;
    let result;
    switch (method) {
      case ChannelMethods.chan_config:
        result = this.config;
        break;
      case ChannelMethods.chan_setUserWithdrawal:
        result = await this.setUserWithdrawal(params.withdrawalObject, params.remove);
        break;
      case ChannelMethods.chan_getUserWithdrawal:
        result = await this.getUserWithdrawals();
        break;
      case ChannelMethods.chan_signMessage:
        result = await this.signMessage(params.message);
        break;
      case ChannelMethods.chan_encrypt:
        result = await this.encrypt(params.message, params.publicIdentifier);
        break;
      case ChannelMethods.chan_decrypt:
        result = await this.decrypt(params.encryptedPreImage);
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

  private decrypt(encryptedPreImage: string): Promise<string> {
    return this.signer.decrypt(encryptedPreImage);
  }

  private walletDeposit = async (params: WalletDepositParams): Promise<string> => {
    let recipient = this.config.multisigAddress;
    if (!recipient) {
      throw new Error(`Cannot make deposit without channel created - missing multisigAddress`);
    }
    let hash;
    if (params.assetId === AddressZero) {
      const tx = await this.signer.sendTransaction({
        to: recipient,
        value: toBN(params.amount),
      });
      hash = tx.hash;
    } else {
      const erc20 = new Contract(params.assetId, tokenAbi, this.signer);
      const tx = await erc20.transfer(recipient, toBN(params.amount));
      hash = tx.hash;
    }
    return hash;
  };

  private getUserWithdrawals = async (): Promise<WithdrawalMonitorObject[]> => {
    return this.store.getUserWithdrawals();
  };

  private setUserWithdrawal = async (
    value: WithdrawalMonitorObject, 
    remove: boolean = false,
  ): Promise<void> => {
    if (remove) {
      return this.store.removeUserWithdrawal(value);
    }
    const existing = await this.getUserWithdrawals();
    if (existing.length === 0) {
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

  private subscribeChannelCreation() {
    this.cfCore.once(EventNames.CREATE_CHANNEL_EVENT, (data: CreateChannelMessage): void => {
      this.config.multisigAddress = data.data.multisigAddress;
    });
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
