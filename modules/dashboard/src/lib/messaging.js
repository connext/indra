import { MessagingServiceFactory } from "@connext/messaging";
import uuid from "uuid";
import { Wallet } from "ethers";
import { arrayify } from "ethers/utils";
import { fromExtendedKey, fromMnemonic } from "ethers/utils/hdnode";

import { stringify } from "./utils";

// TODO: import from connext/types
const CF_PATH = "m/44'/60'/0'/25446";

const NATS_ATTEMPTS = 90_000;
const NATS_TIMEOUT = 5_000;
const guardedSubjects = ["channel", "lock", "transfer"];
const sendFailed = "Failed to send message";

export default class AdminMessaging {
  constructor(messagingUrl, adminToken, logLevel = 5) {
    const messagingFactory = new MessagingServiceFactory({
      logLevel,
      messagingUrl, // nodeUrl
    });
    this.messaging = messagingFactory.createService("messaging");
    this.adminToken = adminToken;
    const mnemonic = localStorage.getItem("mnemonic");
    const hdNode = fromExtendedKey(fromMnemonic(mnemonic).extendedKey).derivePath(CF_PATH);
    this.xpub = hdNode.neuter().extendedKey;
    this.signer = new Wallet(hdNode.derivePath("0"));
    console.log(`adminToken: ${this.adminToken}`);
    console.log(`address: ${this.signer.address}`);
    console.log(`xpub: ${this.xpub}`);
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
    return await this.send("admin.get-no-free-balance");
  }

  async getStateChannelByUserPubId(userPublicIdentifier) {
    return await this.send("admin.get-state-channel-by-xpub", {
      userPublicIdentifier,
    });
  }

  async getStateChannelByMultisig(multisigAddress) {
    return await this.send("admin.get-state-channel-by-multisig", {
      multisigAddress,
    });
  }

  async getAllChannelStates() {
    return await this.send("admin.get-all-channels");
  }

  async getChannelsIncorrectProxyFactoryAddress() {
    return await this.send("admin.get-channels-no-proxy-factory");
  }

  async fixChannelsIncorrectProxyFactoryAddress() {
    // use longer timeout bc this function takes a long time
    return await this.send("admin.fix-proxy-factory-addresses", {}, 90_000);
  }

  ///////////////////////////////////////
  ////// TRANSFER API METHODS
  async getAllLinkedTransfers() {
    return await this.send("admin.get-all-linked-transfers");
  }

  async getLinkedTransferByPaymentId(paymentId) {
    return await this.send(`transfer.fetch-linked.${this.xpub}`, {
      paymentId,
    });
  }

  async getToken(subject) {
    if ("admin" === subject.split(".")[0]) {
      return this.adminToken;
    } else if (guardedSubjects.includes(subject.split(".")[0])) {
      if (!this.signer) {
        throw new Error(`Must have instantiated a signer before setting sig token`);
      } else if (!this.sigToken) {
        const nonce = await this.send("auth.getNonce", {
          address: this.signer.address,
        });
        const sig = await this.signer.signMessage(arrayify(nonce));
        this.sigToken = `${nonce}:${sig}`;
        return this.sigToken;
      }
    }
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
    payload.token = await this.getToken(subject);
    let msg;
    try {
      msg = await this.messaging.request(subject, NATS_TIMEOUT, payload);
    } catch (e) {
      throw new Error(`${sendFailed}: ${e.message}`);
    }
    let error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";
    if (error && error.startsWith("Invalid token")) {
      console.log(`Auth error, token might have expired. Let's get a fresh token & try again.`);
      payload.token = await this.getToken(subject);
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
