import { IMessagingService } from "@connext/messaging";
import {
  AppRegistry,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  SupportedApplication,
  SupportedNetwork,
} from "@connext/types";
import { Address, Node as NodeTypes } from "@counterfactual/types";
import { providers, Wallet } from "ethers";
import { BigNumber } from "ethers/utils";

import { Logger } from "../lib/logger";
import { INodeApiClient } from "../node";
import { ClientOptions, NodeInitializationParameters } from "../types";

type TransactionRequest = providers.TransactionRequest;
type TransactionResponse = providers.TransactionResponse;

export const address: string = "0x627306090abab3a6e1400e9345bc60c78a8bef57";
export const mnemonic: string =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";
export const privateKey: string =
  "0x8339a8d4aa2aa5771f0230f50c725a4d6e6b7bc87bbf8b63b0c260285346eff6";
export const ethUrl: string = process.env.ETH_RPC_URL || "http://localhost:8545";
export const nodeUrl: string = process.env.NODE_URL || "nats://morecoolstuffs";

export class MockMessagingService implements IMessagingService {
  private returnVals: any = MockNodeClientApi.returnValues;

  async connect(): Promise<void> {
    console.log(`[MockMessaging] connect`);
  }

  async disconnect(): Promise<void> {
    console.log(`[MockMessaging] connect`);
  }

  async onReceive(subject: string, callback: (msg: any) => void): Promise<void> {
    console.log(`[MockMessaging] Registered callback for subject ${subject}`);
  }

  public request(subject: string, timeout: number, body?: any): any {
    console.log(`[MockMessaging] Sending request to ${subject}`);
    return (this.returnVals as any)[subject];
  }

  async send(to: string, msg: any): Promise<void> {
    console.log(`[MockMessaging] Sending message to ${to}: ${JSON.stringify(msg)}`);
  }

  async publish(to: string, msg: any): Promise<void> {
    console.log(`[MockMessaging] Publishing message to ${to}: ${JSON.stringify(msg)}`);
  }

  async subscribe(subject: string, callback: (msg: any) => void): Promise<void> {
    console.log(`[MockMessaging] Registered subscription for subject ${subject}`);
  }

  async unsubscribe(subject: string): Promise<void> {
    console.log(`[MockMessaging] Unsubscribing from ${subject}`);
  }

  public patch(subject: string, returnValue: any): any {
    (this.returnVals as any)[subject] = returnValue;
  }
}

export class MockNodeClientApi implements INodeApiClient {
  // public receivedUpdateRequests: UpdateRequest[] = []
  public log: Logger;

  private nodeUrl: string;
  private messaging: IMessagingService;
  private nonce: string | undefined;
  private signature: string | undefined;

  public constructor(opts: Partial<NodeInitializationParameters> = {}) {
    this.log = new Logger("MockNodeClientApi", opts.logLevel);
    this.messaging = (opts.messaging as any) || new MockMessagingService();
    this.nonce = undefined;
    this.signature = undefined;
  }

  // should have keys same as the message passed in to fake messaging client
  // TODO: how well will this work with dynamic paths?
  public static returnValues: any = {
    appRegistry: {} as AppRegistry,
    config: {
      chainId: "mocks", // network that your channel is on
      nodePublicIdentifier: "x-pubcooolstuffs", // x-pub of node
      nodeUrl,
    },
    // TODO: mock out properly!! create mocking fns!!!
    createChannel: {} as CreateChannelResponse,
    getChannel: {} as GetChannelResponse,
  };

  public async appRegistry(appDetails?: {
    name: SupportedApplication;
    network: SupportedNetwork;
  }): Promise<AppRegistry> {
    return MockNodeClientApi.returnValues.appRegistry;
  }

  public async config(): Promise<GetConfigResponse> {
    return MockNodeClientApi.returnValues.config;
  }

  public async getChannel(): Promise<GetChannelResponse> {
    return MockNodeClientApi.returnValues.getChannel;
  }

  public async getLatestSwapRate(from: string, to: string): Promise<string> {
    return "100";
  }

  public async createChannel(): Promise<CreateChannelResponse> {
    return MockNodeClientApi.returnValues.createChannel;
  }

  public async subscribeToSwapRates(
    from: string,
    to: string,
    store: NodeTypes.IStoreService,
  ): Promise<void> {}

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {}

  public async requestCollateral(): Promise<void> {}
}
