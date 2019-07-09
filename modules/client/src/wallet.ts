import { providers, Signer, utils, Wallet as EthersWallet } from "ethers";

import { Logger } from "./lib/logger";
import { objMapPromise } from "./lib/utils";
import { ClientOptions } from "./types";

type TransactionRequest = providers.TransactionRequest;
type TransactionResponse = providers.TransactionResponse;
type JsonRpcProviderType = providers.JsonRpcProvider;

const JsonRpcProvider = providers.JsonRpcProvider;

const arrayify = utils.arrayify;
const bigNumberify = utils.bigNumberify;
const isHexString = utils.isHexString;
const toUtf8Bytes = utils.toUtf8Bytes;

// TODO: do we need this class if there's no auth yet (or JWT auth)
// and CF handles signing? should this class include the keygen fn ref somehow
export class Wallet extends Signer {
  public provider: JsonRpcProviderType;
  private signer: EthersWallet;
  public address: string;
  private external: boolean = false;
  public log: Logger;

  public constructor(opts: ClientOptions) {
    super();

    ////////////////////////////////////////
    // Setup wallet logger
    this.log = new Logger("Wallet", opts.logLevel);

    ////////////////////////////////////////
    // Connect to an eth provider
    if (opts.rpcProviderUrl) {
      // preferentially use provided rpc url
      this.provider = new JsonRpcProvider(opts.rpcProviderUrl);
    } else {
      // access hubs eth url
      // TODO: http or https? is this the right default URL?
      const nodeEthUrl = `https://${opts.nodeUrl.split("nats://")[1]}/api/eth`;
      this.provider = new JsonRpcProvider(nodeEthUrl);
    }
    // TODO: will we be able to use the hubs eth provider?

    // Enforce using provided signer, not via RPC
    this.provider.getSigner = (addressOrIndex?: string | number): any => {
      throw { code: "UNSUPPORTED_OPERATION" };
    };

    ////////////////////////////////////////
    // Setup a signer
    if (opts.privateKey) {
      this.signer = new EthersWallet(opts.privateKey);
      this.signer = this.signer.connect(this.provider);
      this.address = this.signer.address.toLowerCase();
    } else if (opts.mnemonic) {
      // Second choice: Sign w mnemonic
      this.signer = EthersWallet.fromMnemonic(opts.mnemonic);
      this.signer = this.signer.connect(this.provider);
      this.address = this.signer.address.toLowerCase();
    } else if (opts.externalWallet) {
      // Third choice: External wallets
      this.signer = opts.externalWallet;
      this.external = true;
      this.address = opts.externalWallet.address.toLowerCase();
    } else {
      throw new Error(`Wallet needs to be given a signer!`);
    }
  }

  public async getAddress(): Promise<string> {
    return this.address;
  }

  public async signMessage(message: string): Promise<string> {
    const bytes: Uint8Array = isHexString(message) ? arrayify(message) : toUtf8Bytes(message);
    return this.signer.signMessage(bytes);
  }

  public async sendTransaction(txReq: TransactionRequest): Promise<TransactionResponse> {
    if (this.external) {
      return this.signAndSendTransactionExternally(txReq);
    }
    return this.signer.sendTransaction(txReq);
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.sign(tx);
  }

  private async signAndSendTransactionExternally(tx: TransactionRequest): Promise<any> {
    const txObj: any = await this.prepareTransaction(tx);
    return this.signer.sign(txObj);
  }

  private async prepareTransaction(tx: TransactionRequest): Promise<any> {
    tx.gasPrice = await (tx.gasPrice || this.provider.getGasPrice());
    // Sanity check: Do we have sufficient funds for this tx?
    const balance = bigNumberify(await this.provider.getBalance(this.address));
    const gasLimit = bigNumberify((await tx.gasLimit) || "21000");
    const gasPrice = bigNumberify(await tx.gasPrice);
    const value = bigNumberify(await (tx.value || "0"));
    const total = value.add(gasLimit.mul(gasPrice));
    if (balance.lt(total)) {
      throw new Error(
        `Insufficient funds: value=${value} + (gasPrice=${gasPrice} * gasLimit=${gasLimit}) = ` +
          `total=${total} > balance=${balance}`,
      );
    }

    // External wallets should have their own nonce calculation
    if (!tx.nonce && this.signer && !this.external) {
      tx.nonce = this.signer.getTransactionCount("pending");
    }
    // resolve any promise fields
    const resolve: any = async (k: string, v: any): Promise<any> => v;
    const resolved: any = (await objMapPromise(tx, resolve)) as any;
    // convert to right object
    return {
      data: resolved.data,
      from: this.address,
      gas: parseInt(resolved.gasLimit, 10),
      gasPrice: resolved.gasPrice,
      to: resolved.to,
      value: resolved.value,
    };
  }
}
