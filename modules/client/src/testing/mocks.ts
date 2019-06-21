import { NodeConfig, User } from "@connext/types";
import { Address } from "@counterfactual/types";
import { providers } from "ethers";
import * as nats from "ts-nats";

import { Logger } from "../lib/logger";
import { INodeApiClient } from "../node";
import { ClientOptions, NodeInitializationParameters } from "../types";
import { Wallet } from "../wallet";

type TransactionRequest = providers.TransactionRequest;
type TransactionResponse = providers.TransactionResponse;

export const address: string = "0x627306090abab3a6e1400e9345bc60c78a8bef57";
export const mnemonic: string =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
export const privateKey: string =
  "0x8339a8d4aa2aa5771f0230f50c725a4d6e6b7bc87bbf8b63b0c260285346eff6";
export const ethUrl: string = process.env.ETH_RPC_URL || "http://localhost:8545";
export const nodeUrl: string = process.env.NODE_URL || "nats://morecoolstuffs";

export class MockNatsClient extends nats.Client {
  private returnVals: any = MockNodeClientApi.returnValues;

  public request(subject: string, timeout: number, body?: any): any {
    console.log(`Sending request to ${subject} ${body ? `with body: ${body}` : `without body`}`);
    return (this.returnVals as any)[subject];
  }

  public patch(subject: string, returnValue: any): any {
    (this.returnVals as any)[subject] = returnValue;
  }
}

export class MockWallet extends Wallet {
  public address: string;

  public constructor(opts: Partial<ClientOptions> & { address?: string } = {}) {
    // properly assign opts
    const clientOpts = {
      nodeUrl,
      privateKey,
      rpcProviderUrl: ethUrl,
      ...opts,
    };
    super(clientOpts as any);
    this.address = opts.address || address;
  }

  public async getAddress(): Promise<string> {
    return this.address;
  }

  public async sendTransaction(txReq: TransactionRequest): Promise<TransactionResponse> {
    console.log(`Sending transaction: ${JSON.stringify(txReq, null, 2)}`);
    return {} as TransactionResponse;
  }

  public async signTransaction(txReq: TransactionRequest): Promise<string> {
    return "";
  }

  public async signMessage(message: string): Promise<string> {
    console.log(`Signing message: ${message}`);
    return "";
  }
}

export class MockNodeClientApi implements INodeApiClient {
  // public receivedUpdateRequests: UpdateRequest[] = []
  public log: Logger;

  private nodeUrl: string;
  private nats: MockNatsClient; // TODO: rename to messaging?
  public wallet: MockWallet;
  private address: Address;
  private nonce: string | undefined;
  private signature: string | undefined;

  public constructor(opts: Partial<NodeInitializationParameters> = {}) {
    this.log = new Logger("MockNodeClientApi", opts.logLevel);
    this.nodeUrl = opts.nodeUrl || nodeUrl;
    this.nats = (opts.nats as any) || new MockNatsClient(); // TODO: rename to messaging?
    this.wallet = opts.wallet || new MockWallet();
    this.address = opts.wallet ? opts.wallet.address : address;
    this.nonce = undefined;
    this.signature = undefined;
  }

  // should have keys same as the message passed in to fake nats client
  // TODO: how well will this work with dynamic paths?
  public static returnValues: any = {
    config: {
      chainId: "mocks", // network that your channel is on
      nodePublicIdentifier: "x-pubcooolstuffs", // x-pub of node
      nodeUrl,
    },
    // TODO: mock out properly!! create mocking fns!!!
    createChannel: {} as User,
    getChannel: {} as User,
  };

  public authenticate(): void {}

  public async config(): Promise<NodeConfig> {
    return MockNodeClientApi.returnValues.config;
  }

  public async getChannel(): Promise<User> {
    return MockNodeClientApi.returnValues.getChannel;
  }

  public async createChannel(): Promise<User> {
    return MockNodeClientApi.returnValues.createChannel;
  }
}
