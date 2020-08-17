import { MessagingService } from "@connext/messaging";
import {
  ConnextEventEmitter,
  IMessagingService,
  MessagingConfig,
  GenericMessage,
  VerifyNonceDtoType,
  IChannelSigner,
  ProtocolParam,
  ProtocolName,
  ProtocolNames,
} from "@connext/types";
import { ChannelSigner, stringify } from "@connext/utils";
import axios, { AxiosResponse } from "axios";
import { Wallet } from "ethers";

import { env } from "./env";
import { ethProviderUrl } from "./ethprovider";
import { getTestLoggers, combineObjects } from "./misc";
import { expect } from "./assertions";

const { log } = getTestLoggers("Messaging");

// set an artificially high limit to effectively prevent any
// messaging limits by default (and easily allow for 0)
export const NO_LIMIT = 100_000_000;

// TYPES

// Messaging events emitted by the class when that fn is called
export const RECEIVED = "RECEIVED";
export const SEND = "SEND";
export const CONNECT = "CONNECT";
export const DISCONNECT = "DISCONNECT";
export const FLUSH = "FLUSH";
export const PUBLISH = "PUBLISH";
export const REQUEST = "REQUEST";
export const SUBSCRIBE = "SUBSCRIBE";
export const UNSUBSCRIBE = "UNSUBSCRIBE";
export const SUBJECT_FORBIDDEN = "SUBJECT_FORBIDDEN";
export const MessagingEvents = {
  [RECEIVED]: RECEIVED,
  [SEND]: SEND,
  [CONNECT]: CONNECT,
  [DISCONNECT]: DISCONNECT,
  [FLUSH]: FLUSH,
  [PUBLISH]: PUBLISH,
  [REQUEST]: REQUEST,
  [SUBSCRIBE]: SUBSCRIBE,
  [UNSUBSCRIBE]: UNSUBSCRIBE,
  [SUBJECT_FORBIDDEN]: SUBJECT_FORBIDDEN,
};
export type MessagingEvent = keyof typeof MessagingEvents;
export type MessagingEventData = {
  subject?: string;
  data?: any;
};

export type SendReceiveCounter = {
  [SEND]: number;
  [RECEIVED]: number;
};

// used internally to track information about messages sent
// within a protocol, indexed by protocol name
type ProtocolMessageCounter = {
  [k: string]: SendReceiveCounter;
};

// used internally to track protocol limits, indexed by protocol name
type UnindexedLimit = {
  ceiling: SendReceiveCounter;
  params?: Partial<ProtocolParam>;
};
type InternalProtocolLimits = {
  [k: string]: UnindexedLimit;
};

// user-supplied messaging limits at protocol level, indexed by protocol name
type ProtocolMessageLimitInputs = Partial<{
  [k: string]: {
    ceiling: Partial<SendReceiveCounter>;
    params?: Partial<ProtocolParam>;
  };
}>;

// used to track all types of messages sent/received.
// keys in this object are type MessageEvent
type ApiCounter = {
  [key: string]: number;
};

// used internally to track messaging limits, indexed by MessageEvent
type ApiLimits = {
  [k: string]: { ceiling: number };
  // can add more filtering options if needed
};

// all user-supplied config options
export type TestMessagingConfig = {
  nodeUrl: string;
  messagingConfig: MessagingConfig;
  protocolLimits: ProtocolMessageLimitInputs;
  apiLimits: ApiLimits;
  signer: IChannelSigner;
  stopOnCeilingReached: boolean;
};

type InternalMessagingConfig = Omit<TestMessagingConfig, "protocolLimits"> & {
  protocolLimits: InternalProtocolLimits;
};

// Helpers for parsing protocol data from messages
export const getProtocolFromData = (msg: MessagingEventData) => {
  const { data } = msg;
  if (!data) {
    return;
  }
  if (data.protocol) {
    return data.protocol;
  }
  if (data.data && data.data.protocol) {
    // fast forward
    return data.data.protocol;
  }
};

export const getParamsFromData = (msg: MessagingEventData) => {
  const { data } = msg;
  if (!data) {
    return;
  }
  if (data.params) {
    return data.params;
  }
  if (data.data && data.data.params) {
    // fast forward
    return data.data.params;
  }
};

// generate default config options
const getDefaultApiLimits = (): ApiLimits => {
  const ret = {};
  Object.keys(MessagingEvents).forEach((event) => {
    ret[event] = { ceiling: NO_LIMIT };
  });
  return ret;
};

const getDefaultProtocolLimits = (): InternalProtocolLimits => {
  const ret = {};
  Object.keys(ProtocolNames).forEach((event) => {
    ret[event] = {
      ceiling: { [SEND]: NO_LIMIT, [RECEIVED]: NO_LIMIT },
      params: undefined,
    };
  });
  return ret;
};

const defaultOpts = (): TestMessagingConfig => {
  return {
    nodeUrl: env.nodeUrl,
    messagingConfig: {
      messagingUrl: env.natsUrl,
    },
    apiLimits: getDefaultApiLimits(),
    protocolLimits: getDefaultProtocolLimits(),
    signer: new ChannelSigner(Wallet.createRandom().privateKey, ethProviderUrl),
    stopOnCeilingReached: false,
  };
};

export const initApiCounter = (): ApiCounter => {
  const ret = {};
  Object.keys(MessagingEvents).forEach((key) => {
    ret[key] = 0;
  });
  return ret;
};

export const initProtocolCounter = (): ProtocolMessageCounter => {
  const ret = {};
  Object.keys(ProtocolNames).forEach((key) => {
    ret[key] = { [SEND]: 0, [RECEIVED]: 0 };
  });
  return ret;
};

export class TestMessagingService extends ConnextEventEmitter implements IMessagingService {
  private connection: MessagingService;
  // key is ProtocolName, and this tracks all messages sent / received
  // by protocol
  private protocolCounter: ProtocolMessageCounter = initProtocolCounter();
  // keys are of type MessageEvent, tracks all message action
  // across the functions
  private apiCounter: ApiCounter = initApiCounter();
  public providedOptions: Partial<TestMessagingConfig>;
  public options: InternalMessagingConfig;
  private hasReachedCeiling: boolean = false;

  constructor(opts: Partial<TestMessagingConfig>) {
    super();
    // create options
    this.providedOptions = opts;
    const defaults = defaultOpts();
    this.options = {
      ...combineObjects(opts, defaults),
      signer:
        opts.signer && typeof opts.signer === "string"
          ? new ChannelSigner(opts.signer, ethProviderUrl)
          : opts.signer || defaults.signer,
    } as InternalMessagingConfig;
    const getSignature = (msg: string) => this.options.signer.signMessage(msg);

    const getBearerToken = async (
      userIdentifier: string,
      getSignature: (nonce: string) => Promise<string>,
    ): Promise<string> => {
      try {
        const authUrl = `${this.options.nodeUrl}/auth`;
        const nonce = await axios.get(`${authUrl}/${userIdentifier}`);
        const sig = await getSignature(nonce.data);
        const bearerToken: AxiosResponse<string> = await axios.post(
          authUrl,
          {
            sig,
            userIdentifier: userIdentifier,
          } as VerifyNonceDtoType,
        );
        return bearerToken.data;
      } catch (e) {
        return e;
      }
    };

    // NOTE: high maxPingOut prevents stale connection errors while time-travelling
    log.info(`Creating test messaging service w opts: ${stringify(this.options)}`);
    this.connection = new MessagingService(
      { ...this.options.messagingConfig, logger: log.newContext("TestMessagingService") },
      `INDRA`,
      () => getBearerToken(this.options.signer.publicIdentifier, getSignature),
    );
  }

  ////////////////////////////////////////
  // Getters / setters

  // top level
  get protocolLimits() {
    return this.options.protocolLimits;
  }
  get protocolCount() {
    return this.protocolCounter;
  }

  get apiLimits() {
    return this.options.apiLimits;
  }
  get apiCount() {
    return this.apiCounter;
  }

  // by protocol
  get setupLimit(): UnindexedLimit {
    return this.protocolLimits[ProtocolNames.setup];
  }
  get setupCount(): SendReceiveCounter {
    return this.protocolCounter[ProtocolNames.setup];
  }

  get proposeLimit(): UnindexedLimit {
    return this.protocolLimits[ProtocolNames.propose];
  }
  get proposeCount(): SendReceiveCounter {
    return this.protocolCounter[ProtocolNames.propose];
  }

  get installLimit(): UnindexedLimit {
    return this.protocolLimits[ProtocolNames.install];
  }
  get installCount(): SendReceiveCounter {
    return this.protocolCounter[ProtocolNames.install];
  }

  get takeActionLimit(): UnindexedLimit {
    return this.protocolLimits[ProtocolNames.takeAction];
  }
  get takeActionCount(): SendReceiveCounter {
    return this.protocolCounter[ProtocolNames.takeAction];
  }

  get uninstallLimit(): UnindexedLimit {
    return this.protocolLimits[ProtocolNames.uninstall];
  }
  get uninstallCount(): SendReceiveCounter {
    return this.protocolCounter[ProtocolNames.uninstall];
  }

  ////////////////////////////////////////
  // IMessagingService Methods
  onReceive(subject: string, callback: (msg: GenericMessage) => void): Promise<void> {
    // return connection callback
    return this.connection.onReceive(subject, (msg: GenericMessage) => {
      const shouldContinue = this.emitEventAndIncrementApiCount(RECEIVED, {
        subject,
        data: msg,
      } as MessagingEventData);
      // check if there is a high level limit on messages received
      if (!shouldContinue) {
        log.info(
          `Reached API ceiling, refusing to process any more messages. Received ${this.apiCounter[RECEIVED]} total message`,
        );
        return Promise.resolve();
      }
      // check if any protocol messages are increased
      const protocol = getProtocolFromData(msg);
      if (!protocol) {
        // Could not find protocol corresponding to received message,
        // proceeding with callback
        return callback(msg);
      }
      const canContinue = this.incrementProtocolCount(protocol, msg, RECEIVED);
      if (!canContinue || (this.hasReachedCeiling && this.options.stopOnCeilingReached)) {
        const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached (received). ${stringify(
          this.protocolCounter[protocol],
        )}`;
        log.info(msg);
        return Promise.resolve();
      }
      // has params specified, but not included in this message.
      // so return callback
      return callback(msg);
    });
  }

  send(to: string, msg: GenericMessage): Promise<void> {
    const shouldContinue = this.emitEventAndIncrementApiCount(SEND, {
      subject: to,
      data: msg,
    } as MessagingEventData);
    // check if there is a high level limit on messages received
    if (!shouldContinue) {
      log.info(
        `Reached API ceiling, refusing to process any more messages. Sent ${this.apiCounter[SEND]} total messages`,
      );
      return Promise.resolve();
    }

    // check protocol ceiling
    const protocol = getProtocolFromData(msg);
    if (!protocol) {
      // Could not find protocol corresponding to received message,
      // proceeding with sending
      return this.connection.send(to, msg);
    }
    const canContinue = this.incrementProtocolCount(protocol, msg, SEND);
    if (!canContinue || (this.hasReachedCeiling && this.options.stopOnCeilingReached)) {
      const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached (send). ${stringify(
        this.protocolCounter[protocol],
      )}`;
      log.info(msg);
      return Promise.resolve();
    }

    return this.connection.send(to, msg);
  }

  ////////////////////////////////////////
  // More generic methods

  connect(): Promise<void> {
    this.emitEventAndIncrementApiCount(CONNECT, {} as MessagingEventData);
    return this.connection.connect();
  }

  disconnect(): Promise<void> {
    this.emitEventAndIncrementApiCount(DISCONNECT, {} as MessagingEventData);
    return this.connection.disconnect();
  }

  flush(): Promise<void> {
    this.emitEventAndIncrementApiCount(FLUSH, {} as MessagingEventData);
    return this.connection.flush();
  }

  publish(subject: string, data: any): Promise<void> {
    // make sure that client is allowed to send message
    this.emitEventAndIncrementApiCount(PUBLISH, { data, subject } as MessagingEventData);
    return this.connection.publish(subject, data);
  }

  request(subject: string, timeout: number, data: object): Promise<any> {
    // make sure that client is allowed to send message
    // note: when sending via node.ts uses request
    // make sure that client is allowed to send message

    this.emitEventAndIncrementApiCount(REQUEST, { data, subject } as MessagingEventData);
    return this.connection.request(subject, timeout, data);
  }

  subscribe(subject: string, callback: (msg: GenericMessage) => void): Promise<void> {
    return this.connection.subscribe(subject, (msg: GenericMessage) => {
      this.emitEventAndIncrementApiCount(SUBSCRIBE, { subject, data: msg } as MessagingEventData);
      return callback(msg);
    });
  }

  unsubscribe(subject: string): Promise<void> {
    this.emitEventAndIncrementApiCount(UNSUBSCRIBE, { subject } as MessagingEventData);
    return this.connection.unsubscribe(subject);
  }

  ////////////////////////////////////////
  // Private methods

  // returns true if the message should continue, false if the message
  // has reached its ceiling
  private emitEventAndIncrementApiCount(event: MessagingEvent, data: MessagingEventData): boolean {
    this.emit(event, data);
    this.apiCounter[event]++;
    return this.apiCounter[event] < this.apiLimits[event].ceiling;
  }

  // returns true if the callback should continue, false if the protocol
  // messaging limits have been reached.
  private incrementProtocolCount(
    protocol: ProtocolName,
    msg: GenericMessage,
    apiType: typeof SEND | typeof RECEIVED,
    shouldLog: boolean = false,
  ): boolean {
    const logIf = (msg: string) => {
      if (shouldLog) {
        log.info(msg);
      }
    };
    // get the params from the message and our limits
    const msgParams = getParamsFromData(msg);
    const { ceiling: indexedCeiling, params } = this.protocolLimits[protocol];

    const exists = (x) => x !== undefined && x !== null;
    const ceiling = exists(indexedCeiling[apiType]) ? indexedCeiling[apiType] : NO_LIMIT;

    const evaluateCeiling = () => {
      if (this.protocolCounter[protocol][apiType] >= ceiling) {
        this.hasReachedCeiling = true;
        return false;
      }
      this.protocolCounter[protocol][apiType]++;
      return this.protocolCounter[protocol][apiType] < ceiling;
    };

    logIf(`protocol: ${protocol}`);
    logIf(`ceiling: ${ceiling}`);
    logIf(`indexedCeiling[${apiType}]: ${stringify(indexedCeiling[apiType])}`);

    if (!params) {
      // nothing specified, applies to all
      return evaluateCeiling();
    }

    if (params && !msgParams) {
      // params specified but none in message, dont evaluate
      // ceiling and continue execution. dont increment counts.
      return true;
    }

    try {
      expect(msgParams).to.containSubset(params);
      const ret = evaluateCeiling();
      logIf(`evaluated, should continue: ${ret}`);
      // does contain params
      return evaluateCeiling();
    } catch (e) {
      // does not contain params, ignore
      return true;
    }
  }
}
