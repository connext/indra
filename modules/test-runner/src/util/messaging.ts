import { MessagingService } from "@connext/messaging";
import {
  ConnextEventEmitter,
  IMessagingService,
  MessagingConfig,
  Message,
  VerifyNonceDtoType,
  IChannelSigner,
  ProtocolParam,
  ProtocolName,
  ProtocolNames,
} from "@connext/types";
import { ChannelSigner, ColorfulLogger, stringify } from "@connext/utils";
import axios, { AxiosResponse } from "axios";
import { Wallet } from "ethers";

import { env } from "./env";

const log = new ColorfulLogger("Messaging", env.logLevel);

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
};

type InternalMessagingConfig = Omit<TestMessagingConfig, "protocolLimits"> & {
  protocolLimits: InternalProtocolLimits;
};

// Helpers for parsing protocol data from messages
export const getProtocolFromData = (msg: MessagingEventData) => {
  const { subject, data } = msg;
  if (!data || !subject) {
    return;
  }
  if (data.data && data.data.protocol) {
    // fast forward
    return data.data.protocol;
  }
};

export const getParamsFromData = (msg: MessagingEventData) => {
  const { subject, data } = msg;
  if (!data || !subject) {
    return;
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
      messagingUrl: "nats://172.17.0.1:4222",
    },
    apiLimits: getDefaultApiLimits(),
    protocolLimits: getDefaultProtocolLimits(),
    signer: new ChannelSigner(Wallet.createRandom().privateKey, env.ethProviderUrl),
  };
};

export const initApiCounter = (): ApiCounter => {
  let ret = {};
  Object.keys(MessagingEvents).forEach((key) => {
    ret[key] = 0;
  });
  return ret;
};

export const initProtocolCounter = (): ProtocolMessageCounter => {
  let ret = {};
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

  constructor(opts: Partial<TestMessagingConfig>) {
    super();
    // create options
    this.providedOptions = opts;
    const defaults = defaultOpts();
    this.options = {
      ...defaults,
      ...opts,
      signer:
        opts.signer && typeof opts.signer === "string"
          ? new ChannelSigner(opts.signer, env.ethProviderUrl)
          : defaults.signer,
    } as InternalMessagingConfig;
    const getSignature = (msg: string) => this.options.signer.signMessage(msg);

    const getBearerToken = async (
      userIdentifier: string,
      getSignature: (nonce: string) => Promise<string>,
    ): Promise<string> => {
      try {
        const nonce = await axios.get(`${this.options.nodeUrl}/auth/${userIdentifier}`);
        const sig = await getSignature(nonce.data);
        const bearerToken: AxiosResponse<string> = await axios.post(
          `${this.options.nodeUrl}/auth`,
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
    const key = `INDRA`;
    this.connection = new MessagingService(this.options.messagingConfig, key, () =>
      getBearerToken(this.options.signer.publicIdentifier, getSignature),
    );
  }

  ////////////////////////////////////////
  // Getters / setters

  // top level
  get protocolLimits() {
    return this.protocolLimits;
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
  async onReceive(subject: string, callback: (msg: Message) => void): Promise<void> {
    // return connection callback
    return this.connection.onReceive(subject, async (msg: Message) => {
      const shouldContinue = this.emitEventAndIncrementApiCount(RECEIVED, {
        subject,
        data: msg,
      } as MessagingEventData);
      // check if there is a high level limit on messages received
      if (!shouldContinue) {
        log.warn(
          `Reached API ceiling, refusing to process any more messages. Received ${this.apiCounter[RECEIVED]} total messages`,
        );
        return;
      }
      // check if any protocol messages are increased
      const protocol = getProtocolFromData(msg);
      if (!protocol) {
        // Could not find protocol corresponding to received message,
        // proceeding with callback
        return callback(msg);
      }
      const canContinue = this.incrementProtocolCount(protocol, msg, RECEIVED);
      if (!canContinue) {
        const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached. ${stringify(
          this.protocolCounter[protocol],
        )}`;
        log.warn(msg);
        return;
      }
      // has params specified, but not included in this message.
      // so return callback
      return callback(msg);
    });
  }

  async send(to: string, msg: Message): Promise<void> {
    const shouldContinue = this.emitEventAndIncrementApiCount(SEND, {
      subject: to,
      data: msg,
    } as MessagingEventData);
    // check if there is a high level limit on messages received
    if (!shouldContinue) {
      log.warn(
        `Reached API ceiling, refusing to process any more messages. Seny ${this.apiCounter[SEND]} total messages`,
      );
      return;
    }

    // check protocol ceiling
    const protocol = getProtocolFromData(msg);
    if (!protocol) {
      // Could not find protocol corresponding to received message,
      // proceeding with sending
      return this.connection.send(to, msg);
    }
    const canContinue = this.incrementProtocolCount(protocol, msg, RECEIVED);
    if (!canContinue) {
      const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached. ${stringify(
        this.protocolCounter[protocol],
      )}`;
      log.warn(msg);
      return;
    }

    return this.connection.send(to, msg);
  }

  ////////////////////////////////////////
  // More generic methods

  async connect(): Promise<void> {
    this.emitEventAndIncrementApiCount(CONNECT, {} as MessagingEventData);
    await this.connection.connect();
  }

  async disconnect(): Promise<void> {
    this.emitEventAndIncrementApiCount(DISCONNECT, {} as MessagingEventData);
    await this.connection.disconnect();
  }

  async flush(): Promise<void> {
    this.emitEventAndIncrementApiCount(FLUSH, {} as MessagingEventData);
    return this.connection.flush();
  }

  async publish(subject: string, data: any): Promise<void> {
    // make sure that client is allowed to send message
    this.emitEventAndIncrementApiCount(PUBLISH, { data, subject } as MessagingEventData);
    return this.connection.publish(subject, data);
  }

  async request(
    subject: string,
    timeout: number,
    data: object,
    callback?: (response: any) => any,
  ): Promise<any> {
    // make sure that client is allowed to send message
    // note: when sending via node.ts uses request
    // make sure that client is allowed to send message

    this.emitEventAndIncrementApiCount(REQUEST, { data, subject } as MessagingEventData);
    return this.connection.request(subject, timeout, data);
  }

  async subscribe(subject: string, callback: (msg: Message) => void): Promise<void> {
    return this.connection.subscribe(subject, (msg: Message) => {
      this.emitEventAndIncrementApiCount(SUBSCRIBE, { subject, data: msg } as MessagingEventData);
      return callback(msg);
    });
  }

  async unsubscribe(subject: string): Promise<void> {
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
    const limit = this.apiLimits[event]?.ceiling;
    if (limit && this[event] >= limit) {
      // should halt execution after event emission
      return false;
    }
    // no limit or not reached, continue
    return true;
  }

  // returns true if the callback should continue, false if the protocol
  // messaging limits have been reached.
  private incrementProtocolCount(
    protocol: ProtocolName,
    msg: Message,
    apiType: typeof SEND | typeof RECEIVED,
  ): boolean {
    // get the params from the message and our limits
    const msgParams = getParamsFromData(msg);
    const { ceiling, params } = this.protocolLimits[protocol];
    const hasSpecifiedParam = () => {
      const valuesSet = new Set(...Object.values<any>(msgParams), ...Object.values<any>(params));
      return [...valuesSet].length === Object.values(msgParams).length;
    };
    if (params && msgParams && !hasSpecifiedParam()) {
      // params are specified, but they are not included in the
      // message, has not reached limit
      return true;
    }
    // no specified params/not included, check ceiling
    this.protocolCounter[protocol][apiType]++;
    const count = this.protocolCounter[protocol][apiType];
    return count < ceiling;
  }
}
