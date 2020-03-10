import { MessagingService } from "@connext/messaging";
import { ConnextEventEmitter, CFCoreTypes, MessagingConfig, IMessagingService, VerifyNonceDtoType, CF_PATH } from "@connext/types";

import { env } from "./env";
import { combineObjects, delay } from "./misc";
import { Wallet } from "ethers";
import { fromMnemonic } from "ethers/utils/hdnode";

const axios = require('axios').default;

// TYPES
export type MessageCounter = {
  sent: number;
  received: number;
};

type DetailedMessageCounter = MessageCounter & {
  ceiling?: Partial<MessageCounter>;
  delay?: Partial<MessageCounter>;
};

export type TestMessagingConfig = {
  messagingConfig: MessagingConfig;
  protocolDefaults: {
    [protocol: string]: DetailedMessageCounter;
  };
  count: DetailedMessageCounter;
  forbiddenSubjects: string[];
};

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

const defaultCount = (details: string[] = []): MessageCounter | DetailedMessageCounter => {
  if (details.includes("delay") && details.includes("ceiling")) {
    return {
      ...zeroCounter(),
      ceiling: undefined,
      delay: zeroCounter(),
    };
  }

  if (details.includes("delay")) {
    return {
      ...zeroCounter(),
      delay: zeroCounter(),
    };
  }
  return {
    ...zeroCounter(),
    ceiling: undefined,
  };
};

const zeroCounter = (): MessageCounter => {
  return { sent: 0, received: 0 };
};

const defaultOpts = (): TestMessagingConfig => {
  return {
    messagingConfig: {
      messagingUrl: env.nodeUrl,
    },
    protocolDefaults: {
      install: defaultCount(),
      "install-virtual-app": defaultCount(),
      setup: defaultCount(),
      propose: defaultCount(),
      takeAction: defaultCount(),
      uninstall: defaultCount(),
      "uninstall-virtual-app": defaultCount(),
      update: defaultCount(),
      withdraw: defaultCount(),
    },
    count: defaultCount(),
    forbiddenSubjects: [],
  };
};

export class TestMessagingService extends ConnextEventEmitter implements IMessagingService {
  private connection: MessagingService;
  private protocolDefaults: {
    [protocol: string]: DetailedMessageCounter;
  };
  public options: TestMessagingConfig;
  private countInternal: DetailedMessageCounter;
  private forbiddenSubjects: string[];

  constructor(opts: Partial<TestMessagingConfig> = {}) {
    super();
    const defaults = defaultOpts();
    // create options
    this.options = {
      messagingConfig: combineObjects(opts.messagingConfig, defaults.messagingConfig),
      count: combineObjects(opts.count, defaults.count),
      protocolDefaults: combineObjects(opts.protocolDefaults, defaults.protocolDefaults),
      forbiddenSubjects: opts.forbiddenSubjects || defaults.forbiddenSubjects,
    };

    const hdNode = fromMnemonic(Wallet.createRandom().mnemonic).derivePath(CF_PATH);
    const xpub = hdNode.neuter().extendedKey;
    const getSignature = (nonce: string): Promise<string> =>
      Promise.resolve(new Wallet(hdNode.derivePath('0').privateKey).signMessage(nonce));

    const getBearerToken = async (xpub: string, getSignature: (nonce: string) => Promise<string>): Promise<string> => {
      const messagingUrl = this.options.messagingConfig.messagingUrl as string;
      try {
        let url = messagingUrl.split("//")[1]
        const nonce = await axios.get(`https://${url}/getNonce`, {
          params: {
            userPublicIdentifier: xpub
          }
        })
        const sig = await getSignature(nonce);
        const bearerToken: string = await axios.post(`https://${url}/verifyNonce`, {
          sig,
          xpub
        } as VerifyNonceDtoType)
        return bearerToken;
      } catch(e) {
        return e;
      }
    }

    // NOTE: high maxPingOut prevents stale connection errors while time-travelling
    this.connection = new MessagingService(this.options.messagingConfig, "indra", () => getBearerToken(xpub, getSignature))
    this.protocolDefaults = this.options.protocolDefaults;
    this.countInternal = this.options.count;
    this.forbiddenSubjects = this.options.forbiddenSubjects;
  }

  ////////////////////////////////////////
  // Getters / setters

  get setup(): DetailedMessageCounter {
    return this.protocolDefaults.setup;
  }

  get install(): DetailedMessageCounter {
    return this.protocolDefaults.install;
  }

  get installVirtual(): DetailedMessageCounter {
    return this.protocolDefaults["install-virtual-app"];
  }

  get propose(): DetailedMessageCounter {
    return this.protocolDefaults.propose;
  }

  get takeAction(): DetailedMessageCounter {
    return this.protocolDefaults.takeAction;
  }

  get uninstall(): DetailedMessageCounter {
    return this.protocolDefaults.uninstall;
  }

  get uninstallVirtual(): DetailedMessageCounter {
    return this.protocolDefaults["uninstall-virtual-app"];
  }

  get update(): DetailedMessageCounter {
    return this.protocolDefaults.update;
  }

  get withdraw(): DetailedMessageCounter {
    return this.protocolDefaults.withdraw;
  }

  get count(): DetailedMessageCounter {
    return this.countInternal;
  }

  ////////////////////////////////////////
  // CFCoreTypes.IMessagingService Methods
  async onReceive(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    // return connection callback
    return await this.connection.onReceive(subject, async (msg: CFCoreTypes.NodeMessage) => {
      this.emit(RECEIVED, { subject, data: msg } as MessagingEventData);
      // make sure that client is allowed to send message
      this.subjectForbidden(subject, "receive");
      // wait out delay
      await this.awaitDelay();
      if (
        this.hasCeiling({ type: "received" }) &&
        this.count.ceiling!.received! <= this.count.received
      ) {
        env.logLevel > 2 &&
          console.log(
            `Reached ceiling (${
              this.count.ceiling!.received
            }), refusing to process any more messages. Received ${this.count.received} messages`,
          );
        return;
      }
      // handle overall protocol count
      this.count.received += 1;

      // check if any protocol messages are increased
      const protocol = this.getProtocol(msg);
      if (!protocol || !this.protocolDefaults[protocol]) {
        // Could not find protocol corresponding to received message,
        // proceeding with callback
        return callback(msg);
      }
      // wait out delay
      await this.awaitDelay(false, protocol);
      // verify ceiling exists and has not been reached
      if (
        this.hasCeiling({ protocol, type: "received" }) &&
        this.protocolDefaults[protocol].ceiling!.received! <=
          this.protocolDefaults[protocol].received
      ) {
        const msg = `Refusing to process any more messages, ceiling for ${protocol} has been reached. ${
          this.protocolDefaults[protocol].received
        } received, ceiling: ${this.protocolDefaults[protocol].ceiling!.received!}`;
        env.logLevel > 2 && console.log(msg);
        return;
      }
      this.protocolDefaults[protocol].received += 1;
      // perform callback
      return callback(msg);
    });
  }

  async send(to: string, msg: CFCoreTypes.NodeMessage): Promise<void> {
    this.emit(SEND, { subject: to, data: msg } as MessagingEventData);
    // make sure that client is allowed to send message
    this.subjectForbidden(to, "send");

    // wait out delay
    await this.awaitDelay(true);
    if (this.hasCeiling({ type: "sent" }) && this.count.sent >= this.count.ceiling!.sent!) {
      env.logLevel > 2 &&
        console.log(
          `Reached ceiling (${this.count.ceiling!
            .sent!}), refusing to send any more messages. Sent ${this.count.sent} messages`,
        );
      return;
    }

    // check protocol ceiling
    const protocol = this.getProtocol(msg);
    if (!protocol || !this.protocolDefaults[protocol]) {
      // Could not find protocol corresponding to received message,
      // proceeding with sending
      return await this.connection.send(to, msg);
    }
    // wait out delay
    await this.awaitDelay(true, protocol);
    if (
      this.hasCeiling({ type: "sent", protocol }) &&
      this.protocolDefaults[protocol].sent >= this.protocolDefaults[protocol].ceiling!.sent!
    ) {
      const msg = `Refusing to send any more messages, ceiling for ${protocol} has been reached. ${
        this.protocolDefaults[protocol].sent
      } sent, ceiling: ${this.protocolDefaults[protocol].ceiling!.sent!}`;
      env.logLevel > 2 && console.log(msg);
      return;
    }
    // handle counts
    this.count.sent += 1;
    this.protocolDefaults[protocol].sent += 1;

    // send message, if its a stale connection, retry
    return await this.connection.send(to, msg);
  }

  private awaitDelay = async (isSend: boolean = false, protocol?: string): Promise<any> => {
    const key = isSend ? "sent" : "received";
    if (!protocol) {
      if (!this.count.delay) {
        return;
      }
      return await delay(this.count.delay[key] || 0);
    }
    if (!this.protocolDefaults[protocol] || !this.protocolDefaults[protocol]["delay"]) {
      return;
    }
    return await delay(this.protocolDefaults[protocol]!.delay![key] || 0);
  };

  ////////////////////////////////////////
  // More generic methods

  async connect(): Promise<void> {
    this.emit(CONNECT, {} as MessagingEventData);
    await this.connection.connect();
  }

  async disconnect(): Promise<void> {
    this.emit(DISCONNECT, {} as MessagingEventData);
    await this.connection.disconnect();
  }

  async flush(): Promise<void> {
    this.emit(FLUSH, {} as MessagingEventData);
    return await this.connection.flush();
  }

  async publish(subject: string, data: any): Promise<void> {
    // make sure that client is allowed to send message
    this.subjectForbidden(subject, "publish");
    this.emit(PUBLISH, { data, subject } as MessagingEventData);
    return await this.connection.publish(subject, data);
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

    this.emit(REQUEST, { data, subject } as MessagingEventData);
    this.subjectForbidden(subject, "request");
    return await this.connection.request(subject, timeout, data);
  }

  async subscribe(
    subject: string,
    callback: (msg: CFCoreTypes.NodeMessage) => void,
  ): Promise<void> {
    return await this.connection.subscribe(subject, callback);
  }

  async unsubscribe(subject: string): Promise<void> {
    return await this.connection.unsubscribe(subject);
  }

  ////////////////////////////////////////
  // Private methods
  private subjectForbidden(to: string, operation?: string): boolean {
    let hasSubject = false;
    this.forbiddenSubjects.forEach(subject => {
      if (hasSubject) {
        return;
      }
      // this.forbiddenSubjects may include prefixes, ie it could be
      // `transfer.recipient` when the subject the client uses in `node.ts`
      // is `transfer.recipient.${client.publicIdentifier}`
      hasSubject = to.includes(subject);
    });
    if (hasSubject) {
      const msg = `Subject is forbidden, refusing to ${operation || "send"} data to subject: ${to}`;
      this.emit(SUBJECT_FORBIDDEN, { subject: to } as MessagingEventData);
      throw new Error(msg);
    }
    return hasSubject;
  }

  private getProtocol(msg: any): string | undefined {
    if (!msg.data) {
      // no .data field found, cannot find protocol of msg
      return undefined;
    }
    const protocol = msg.data.protocol;
    if (!protocol) {
      // no .data.protocol field found, cannot find protocol of msg
      return undefined;
    }

    return protocol;
  }

  private hasCeiling(opts: Partial<{ type: "sent" | "received"; protocol: string }> = {}): boolean {
    const { type, protocol } = opts;
    const exists = (value: any | undefined | null): boolean => {
      // will return true if value is null, and will
      // return false if value is 0
      return value !== undefined && value !== null;
    };
    if (!protocol) {
      if (!type) {
        return exists(this.count.ceiling);
      }
      return exists(this.count.ceiling) && exists(this.count.ceiling![type]);
    }
    if (!type) {
      return exists(this.protocolDefaults[protocol].ceiling);
    }
    return (
      exists(this.protocolDefaults[protocol].ceiling) &&
      exists(this.protocolDefaults[protocol].ceiling![type!])
    );
  }
}
