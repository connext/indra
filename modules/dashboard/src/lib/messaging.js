import { MessagingServiceFactory } from "@connext/messaging";
import uuid from "uuid";
import { stringify } from "./utils";

const API_TIMEOUT = 15000;

export default class AdminMessaging {
  constructor(messagingUrl, token, logLevel = 5) {
    const messagingFactory = new MessagingServiceFactory({
      logLevel,
      messagingUrl, // nodeUrl
    });
    this.service = messagingFactory.createService("messaging");
    this.connected = false;
    this.token = token;
  }

  ///////////////////////////////////////
  ////// SETUP FN
  async connect() {
    const res = await this.service.connect();
    this.connected = true;
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

  ///////////////////////////////////////
  ////// SEND REQUEST
  async send(subject, data, timeout = API_TIMEOUT) {
    // assert connected
    if (!this.connected) {
      throw new Error(`Call messaging.connect before calling send`);
    }

    // data is optional
    console.debug(
      `Sending request to admin.${subject} ${
        data ? `with data: ${stringify(data)}` : `without data`
      }`,
    );

    const payload = {
      ...(data || {}),
      id: uuid.v4(),
      token: this.token,
    };

    const msg = await this.service.request(`admin.${subject}`, timeout, payload);
    const error = msg ? (msg.data ? (msg.data.response ? msg.data.response.err : "") : "") : "";

    if (!msg.data) {
      this.log.info(`Maybe this message is malformed: ${stringify(msg)}`);
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
