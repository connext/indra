import { IMessagingService } from "@connext/messaging";
import { providers } from "ethers";

import { Logger } from "../lib";
import { INodeApiClient } from "../node";
import {
  AppRegistry,
  CFCoreTypes,
  ChannelAppSequences,
  CreateChannelResponse,
  GetChannelResponse,
  GetConfigResponse,
  NodeInitializationParameters,
  PaymentProfile,
  RequestCollateralResponse,
  SupportedApplication,
  SupportedNetwork,
  Transfer,
} from "../types";

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
  private log: Logger;

  public constructor(opts: any) {
    this.log = new Logger("MockMessagingService", opts.logLevel);
  }

  async connect(): Promise<void> {
    this.log.info(`Connect`);
  }

  async disconnect(): Promise<void> {
    this.log.info(`Disconnect`);
  }

  async onReceive(subject: string, callback: (msg: any) => void): Promise<void> {
    this.log.info(`Registered callback for subject ${subject}`);
  }

  public request(subject: string, timeout: number, body?: any): any {
    this.log.info(`Sending request to ${subject}`);
    return (this.returnVals as any)[subject];
  }

  async send(to: string, msg: any): Promise<void> {
    this.log.info(`Sending message to ${to}: ${JSON.stringify(msg)}`);
  }

  async publish(to: string, msg: any): Promise<void> {
    this.log.info(`Publishing message to ${to}: ${JSON.stringify(msg)}`);
  }

  async subscribe(subject: string, callback: (msg: any) => void): Promise<void> {
    this.log.info(`Registered subscription for subject ${subject}`);
  }

  async unsubscribe(subject: string): Promise<void> {
    this.log.info(`Unsubscribing from ${subject}`);
  }

  async flush(): Promise<void> {
    this.log.info(`Flushing messaging connection`);
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
    this.messaging = (opts.messaging as any) || new MockMessagingService(opts);
    this.nonce = undefined;
    this.signature = undefined;
  }

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    this.log.info(`acquireLock`);
  }

  // should have keys same as the message passed in to fake messaging client
  // TODO: how well will this work with dynamic paths?
  public static returnValues: any = {
    addPaymentProfile: {} as PaymentProfile,
    appRegistry: {} as AppRegistry,
    config: {
      chainId: "mocks", // network that your channel is on
      nodePublicIdentifier: "x-pubcooolstuffs", // x-pub of node
      nodeUrl,
    },
    // TODO: mock out properly!! create mocking fns!!!
    createChannel: {} as CreateChannelResponse,
    getChannel: {} as GetChannelResponse,
    verifyAppSequenceNumber: {} as ChannelAppSequences,
    withdraw: {} as TransactionResponse,
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

  public async getTransferHistory(): Promise<Transfer[]> {
    return [];
  }

  public async createChannel(): Promise<CreateChannelResponse> {
    return MockNodeClientApi.returnValues.createChannel;
  }

  public async recipientOnline(recipientPublicIdentifier: string): Promise<boolean> {
    return true;
  }

  public async subscribeToSwapRates(
    from: string,
    to: string,
    store: CFCoreTypes.IStoreService,
  ): Promise<void> {}

  public async unsubscribeFromSwapRates(from: string, to: string): Promise<void> {}

  public async requestCollateral(): Promise<RequestCollateralResponse | void> {}

  public async withdraw(): Promise<TransactionResponse> {
    return MockNodeClientApi.returnValues.withdraw;
  }

  public async fetchLinkedTransfer(paymentId: string): Promise<any> {}

  public async resolveLinkedTransfer(): Promise<void> {}

  public async restoreState(publicIdentifier: string): Promise<any> {
    return {
      multisigAddress: address,
    };
  }

  public async addPaymentProfile(): Promise<any> {
    return MockNodeClientApi.returnValues.addPaymentProfile;
  }

  public async getPaymentProfile(): Promise<PaymentProfile | undefined> {
    return undefined;
  }

  public async verifyAppSequenceNumber(): Promise<ChannelAppSequences> {
    return MockNodeClientApi.returnValues.verifyAppSequenceNumber;
  }
}
