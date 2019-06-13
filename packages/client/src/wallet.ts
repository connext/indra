import * as eth from 'ethers'
import {
  JsonRpcProvider,
  TransactionResponse,
  TransactionRequest,
} from "ethers/providers"
import { ClientOptions } from './types';
import { isHexString, arrayify, toUtf8Bytes, bigNumberify } from 'ethers/utils';
import { objMapPromise } from './lib/utils';


// TODO: do we need this class if there's no auth yet (or JWT auth)
// and CF handles signing? should this class include the keygen fn ref somehow
export class Wallet extends eth.Signer {
  public provider: JsonRpcProvider;
  private signer: eth.Wallet;
  public address: string;
  private external: boolean = false;

  public constructor(opts: ClientOptions) {
    super();

    ////////////////////////////////////////
    // Connect to an eth provider
    this.provider = new JsonRpcProvider(opts.rpcProviderUrl)
    // TODO: will we be able to use the hubs eth provider?

    ////////////////////////////////////////
    // Setup a signer
    if (opts.privateKey) {
      this.signer = new eth.Wallet(opts.privateKey)
      this.signer = this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()

    // Second choice: Sign w mnemonic
    } else if (opts.mnemonic) {
      this.signer = eth.Wallet.fromMnemonic(opts.mnemonic)
      this.signer = this.signer.connect(this.provider)
      this.address = this.signer.address.toLowerCase()
    // Third choice: External wallets
    } else if (opts.externalWallet) {
      this.signer = opts.externalWallet;
      this.external = true;
      this.address = opts.externalWallet.address.toLowerCase();
    } else {
      throw new Error(`Wallet needs to be given a signer!`)
    }
  }

  public async getAddress(): Promise<string> {
    return this.address
  }

  public async signMessage(message: string): Promise<string> {
    const bytes: Uint8Array = isHexString(message) ? arrayify(message) : toUtf8Bytes(message)

    return this.signer.signMessage(bytes)
  }

  public async sendTransaction(txReq: TransactionRequest): Promise<TransactionResponse> {
    if (this.external){
      return this.signAndSendTransactionExternally(txReq)
    }
    return this.signer.sendTransaction(txReq)
  }

  public async signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.sign(tx)
  }

  private async signAndSendTransactionExternally(tx: TransactionRequest): Promise<any> {
    const txObj:any = await this.prepareTransaction(tx)
    return this.signer.sign(txObj)
  }

  private async prepareTransaction(tx: TransactionRequest): Promise<any> {
    tx.gasPrice = await (tx.gasPrice || this.provider.getGasPrice())
    // Sanity check: Do we have sufficient funds for this tx?
    const balance = bigNumberify(await this.provider.getBalance(this.address))
    const gasLimit = bigNumberify(await tx.gasLimit || '21000')
    const gasPrice = bigNumberify(await tx.gasPrice)
    const value = bigNumberify(await (tx.value || '0'))
    const total = value.add(gasLimit.mul(gasPrice))
    if (balance.lt(total)) {
      throw new Error(
        `Insufficient funds: value=${value} + (gasPrice=${gasPrice
        } * gasLimit=${gasLimit}) = total=${total} > balance=${balance}`,
      )
    }

    // External wallets should have their own nonce calculation
    if (!tx.nonce && this.signer && !this.external) {
      tx.nonce = this.signer.getTransactionCount('pending')
    }
     // resolve any promise fields
    const resolve: any = async (k: string, v: any): Promise<any> => v
    const resolved: any = await objMapPromise(tx, resolve) as any
    // convert to right object
    return {
      data: resolved.data,
      from: this.address,
      gas: parseInt(resolved.gasLimit, 10),
      gasPrice: resolved.gasPrice,
      to: resolved.to,
      value: resolved.value,
    }
  }
}