import {
  ChannelMethods,
  ConnextEventEmitter,
  EventNames,
  IChannelProvider,
  IClientStore,
  MethodName,
  StateChannelJSON,
  WithdrawalMonitorObject,
  deBigNumberifyJson,
  WalletTransferParams
} from "@connext/types";
import { ChannelProvider } from "@connext/channel-provider";
import { signChannelMessage, signDigest } from "@connext/crypto";
import { Wallet, Contract } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { CFCore, xpubToAddress } from "./lib";
import {
  CFChannelProviderOptions,
  ChannelProviderConfig,
  IRpcConnection,
  JsonRpcRequest,
} from "./types";
import { AddressZero } from "ethers/constants";

export const createCFChannelProvider = async ({
  ethProvider,
  keyGen,
  lockService,
  messaging,
  networkContext,
  nodeConfig,
  nodeUrl,
  store,
  xpub,
  logger,
}: CFChannelProviderOptions): Promise<IChannelProvider> => {
  const cfCore = await CFCore.create(
    messaging,
    store,
    networkContext,
    nodeConfig,
    ethProvider,
    lockService,
    xpub,
    keyGen,
    undefined,
    logger,
  );
  const channelProviderConfig: ChannelProviderConfig = {
    freeBalanceAddress: xpubToAddress(xpub),
    nodeUrl,
    signerAddress: xpubToAddress(xpub),
    userPublicIdentifier: xpub,
  };
  const wallet = new Wallet(await keyGen("0")).connect(ethProvider)
  const connection = new CFCoreRpcConnection(cfCore, store, wallet);
  const channelProvider = new ChannelProvider(connection, channelProviderConfig);
  return channelProvider;
};

export class CFCoreRpcConnection extends ConnextEventEmitter implements IRpcConnection {
  public connected: boolean = true;
  public cfCore: CFCore;
  public store: IClientStore;

  // TODO: replace this when signing keys are added!
  public wallet: Wallet;

  constructor(cfCore: CFCore, store: IClientStore, wallet: Wallet) {
    super();
    this.cfCore = cfCore;
    this.wallet = wallet;
    this.store = store;
  }

  public async send(payload: JsonRpcRequest): Promise<any> {
    const { method, params } = payload;
    let result;
    switch (method) {
      case ChannelMethods.chan_setUserWithdrawal:
        result = await this.storeSetUserWithdrawal(params.withdrawalObject);
        break;
      case ChannelMethods.chan_getUserWithdrawal:
        result = await this.storeGetUserWithdrawal();
        break;
      case ChannelMethods.chan_signMessage:
        result = await this.signMessage(params.message);
        break;
      case ChannelMethods.chan_signDigest:
        result = await this.signDigest(params.message);
        break;
      case ChannelMethods.chan_restoreState:
        result = await this.restoreState();
        break;
      case ChannelMethods.chan_setStateChannel:
        result = await this.setStateChannel(params.state);
        break;
      case ChannelMethods.chan_walletTransfer:
        result = await this.walletTransfer(params);
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
  private signMessage = async (message: string): Promise<string> => {
    return signChannelMessage(this.wallet.privateKey, message);
  };

  private signDigest = async (message: string): Promise<string> => {
    return signDigest(this.wallet.privateKey, message);
  };

  private walletTransfer = async (params: WalletTransferParams): Promise<string> => {
    let result
    if (params.assetId === AddressZero) {
      const tx = await this.wallet.sendTransaction({
        to: params.recipient,
        value: params.amount
      })
      result = tx.hash
    } else {
      const erc20 = new Contract(params.assetId, tokenAbi, this.wallet.provider)
      const tx = await erc20.transfer(params.recipient, params.amount)
      result = tx.txhash
    }
    return result
  }

  private storeGetUserWithdrawal = async (): Promise<WithdrawalMonitorObject | undefined> => {
    return this.store.getUserWithdrawal();
  };

  private storeSetUserWithdrawal = async (
    value: WithdrawalMonitorObject | undefined,
  ): Promise<void> => {
    return this.store.setUserWithdrawal(value);
  };

  private setStateChannel = async (channel: StateChannelJSON): Promise<void> => {
    return this.store.saveStateChannel(channel);
  };

  private restoreState = async (): Promise<void> => {
    await this.store.restore();
  };

  private routerDispatch = async (method: string, params: any = {}) => {
    const ret = await this.cfCore.rpcRouter.dispatch({
      id: Date.now(),
      methodName: method,
      parameters: deBigNumberifyJson(params),
    });
    return ret.result.result;
  };
}
