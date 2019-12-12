import { MessagingServiceFactory } from "@connext/messaging";
import uuid from "uuid";
import { stringify } from "./utils";

const NATS_ATTEMPTS = 90_000;
const NATS_TIMEOUT = 5_000;
const guardedSubjects = ["channel", "lock", "transfer"];
const sendFailed = "Failed to send message";

export default class AdminMessaging {
  constructor(messagingUrl, token, logLevel = 5) {
    const messagingFactory = new MessagingServiceFactory({
      logLevel,
      messagingUrl, // nodeUrl
    });
    this.messaging = messagingFactory.createService("messaging");
    this.token = token;
  }

  ///////////////////////////////////////
  ////// SETUP FN
  async connect() {
    const res = await this.messaging.connect();
    return res;
  }

  ///////////////////////////////////////
  ////// CHANNEL API METHODS
  async getChannelStatesWithNoFreeBalanceApp() {
    return await this.send("get-no-free-balance");
  }

  async getStateChannelByUserPubId(userPublicIdentifier) {
    return await this.send("get-state-channel-by-xpub", {
      userPublicIdentifier,
    });
  }

  async getStateChannelByMultisig(multisigAddress) {
    return await this.send("get-state-channel-by-multisig", {
      multisigAddress,
    });
  }

  async getAllChannelStates() {
    return await this.send("get-all-channels");
  }

  async getChannelsIncorrectProxyFactoryAddress() {
    return await this.send("get-channels-no-proxy-factory");
  }

  async fixChannelsIncorrectProxyFactoryAddress() {
    // use longer timeout bc this function takes a long time
    return await this.send("fix-proxy-factory-addresses", {}, 90_000);
  }

  ///////////////////////////////////////
  ////// TRANSFER API METHODS
  async getAllLinkedTransfers() {
    return await this.send("get-all-linked-transfers");
  }

  async getLinkedTransferByPaymentId(paymentId) {
    return await this.send("get-linked-transfer-by-payment-id", {
      paymentId,
    });
  }

  async getAuthToken() {
    return new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        const nonce = await this.send("auth.getNonce", {
          address: this.channelRouter.signerAddress,
        });
        const sig = await this.channelRouter.signMessage(nonce);
        const token = `${nonce}:${sig}`;
        return resolve(token);
      },
    );
  }

  ///////////////////////////////////////
  ////// SEND REQUEST

  async send(subject, data) {
    let error;
    for (let attempt = 1; attempt <= NATS_ATTEMPTS; attempt += 1) {
      const timeout = new Promise((resolve: any): any => setTimeout(resolve, NATS_TIMEOUT));
      try {
        return await this.sendAttempt(subject, data);
      } catch (e) {
        error = e;
        if (e.message.startsWith(sendFailed)) {
          console.warn(
            `Attempt ${attempt}/${NATS_ATTEMPTS} to send ${subject} failed: ${e.message}`,
          );
          await this.messaging.disconnect();
          await this.messaging.connect();
          if (attempt + 1 <= NATS_ATTEMPTS) {
            await timeout; // Wait at least a NATS_TIMEOUT before retrying
          }
        } else {
          throw e;
        }
      }
    }
    throw error;
  }

  async sendAttempt(subject, data) {
    console.log(
      `Sending request to ${subject} ${data ? `with data: ${stringify(data)}` : `without data`}`,
    );
    const payload = {
      ...data,
      id: uuid.v4(),
    };
    if (guardedSubjects.includes(subject.split(".")[0])) {
      this.assertAuthToken();
      payload.token = await this.token;
    }
    let msg;
    try {
      msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
    } catch (e) {
      throw new Error(`${sendFailed}: ${e.message}`);
    }
    let error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";
    if (error && error.startsWith("Invalid token")) {
      console.log(`Auth error, token might have expired. Let's get a fresh token & try again.`);
      this.token = this.getAuthToken();
      payload.token = await this.token;
      msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
      error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";
    }
    if (!msg.data) {
      console.log(`Maybe this message is malformed: ${stringify(msg)}`);
      return undefined;
    }
    const { err, response } = msg.data;
    if (err || error) {
      throw new Error(`Error sending request. Message: ${stringify(msg)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    return !response || isEmptyObj ? undefined : response;
  }

}
