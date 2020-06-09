import {
  IConnextClient,
  IChannelSigner,
  IStoreService,
  ProtocolNames,
  EventNames,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import { getMemoryStore } from "@connext/store";

import {
  APP_PROTOCOL_TOO_LONG,
  createClient,
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  RECEIVED,
  SEND,
  TestMessagingService,
  env,
  ETH_AMOUNT_SM,
  CLIENT_INSTALL_FAILED,
} from "../util";
import { getRandomChannelSigner, delay } from "@connext/utils";

const makeFailingDepositCall = async (opts: {
  client: IConnextClient;
  error: string;
  event?: string;
}) => {
  const { client, error, event } = opts;
  if (!event) {
    await expect(
      fundChannel(client, ETH_AMOUNT_SM, CONVENTION_FOR_ETH_ASSET_ID),
    ).to.be.rejectedWith(error);
    return;
  }
  await new Promise(async (resolve, reject) => {
    client.once(event as any, (msg) => {
      try {
        expect(msg.params).to.be.an("object");
        expect(msg.error).to.include(error);
        return resolve(msg);
      } catch (e) {
        return reject(e.message);
      }
    });

    try {
      await expect(
        fundChannel(client, ETH_AMOUNT_SM, CONVENTION_FOR_ETH_ASSET_ID),
      ).to.be.rejectedWith(error);
    } catch (e) {
      return reject(e.message);
    }
  });
};

const recreateClientAndRetryDepositCall = async (
  signer: IChannelSigner,
  client: IConnextClient,
  store: IStoreService,
  opts: { id?: string; logLevel?: number } = {},
) => {
  await client.messaging.disconnect();
  // Add delay to make sure messaging properly disconnects
  await delay(1000);
  const newClient = await createClient({ signer, store, id: opts.id, logLevel: opts.logLevel });

  // Check that client can recover and continue
  await fundChannel(newClient, ETH_AMOUNT_SM);
};

/**
 * Contains any deposit tests that involve the client going offline at some
 * point in the protocol.
 */

describe("Deposit offline tests", () => {
  let client: IConnextClient;
  let signer: IChannelSigner;
  let store: IStoreService;

  beforeEach(() => {
    signer = getRandomChannelSigner(env.ethProviderUrl);
    store = getMemoryStore();
  });

  afterEach(async () => {
    client && (await client.store.clear());
    client && (await client.messaging.disconnect());
  });

  /**
   * In this case, the client correctly stops processing received messages
   * so the `proposeInstallApp` call never resolves. However, the node *does*
   * receive the NATS message for the `propose` call so the promise is
   * `resolved`. More importantly, at the protocol level the responders store
   * in the `propose` protocol can be incorrectly updated (ie. proposal is added
   * before it is completed by both parties) if the `initiator` goes offline
   * after sending m1
   */
  it("client proposes deposit, but node doesn't receive the NATS message (or no response from node)", async () => {
    // create client where the propose protocol will not complete
    // in deposit, client will propose the `DepositApp` (is the
    // initiator in the `propose` protocol)
    // in the propose protocol, the initiator sends one message, and receives
    // one message, set the cap at 1 for `propose` in messaging of client

    client = await createClientWithMessagingLimits({
      ceiling: { [RECEIVED]: 0 },
      protocol: ProtocolNames.propose,
      signer,
      store,
    });

    await makeFailingDepositCall({
      client,
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      event: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    });

    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.proposeCount[RECEIVED]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store);
  });

  it("client tries to propose deposit, but first message in propose protocol fails", async () => {
    // cf method timeout is 90s, client will send any messages with a
    // preconfigured delay
    client = await createClientWithMessagingLimits({
      protocol: ProtocolNames.propose,
      ceiling: { [SEND]: 0 },
      signer,
      store,
    });

    await makeFailingDepositCall({
      client,
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      event: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    });

    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.proposeCount[SEND]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store);
  });

  it("client successfully proposed deposit app, but went offline during before install protocol starts", async () => {
    client = await createClientWithMessagingLimits({
      protocol: ProtocolNames.install,
      ceiling: { [RECEIVED]: 0 },
      signer,
      store,
    });

    // NOTE: this failure is expected to happen in between protocols
    // because of that, there should be no protocol failure event,
    // instead, only the promise should reject
    await makeFailingDepositCall({
      client,
      error: CLIENT_INSTALL_FAILED(true),
    });
    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.installCount[RECEIVED]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store);
  });

  it("client successfully proposed deposit app, but went offline during execution of install protocol", async () => {
    client = await createClientWithMessagingLimits({
      protocol: ProtocolNames.install,
      ceiling: { [SEND]: 0 },
      signer,
      store,
      id: "Pre-Offline",
    });

    await makeFailingDepositCall({
      client,
      error: CLIENT_INSTALL_FAILED(true),
    });
    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.installCount[SEND]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store, { id: "Post-Offline" });
  });

  it("client successfully installed deposit app, but went offline before uninstall", async () => {
    client = await createClientWithMessagingLimits({
      protocol: ProtocolNames.uninstall,
      ceiling: { [RECEIVED]: 0 },
      signer,
      store,
    });

    await makeFailingDepositCall({
      client,
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.uninstall),
      event: EventNames.UNINSTALL_FAILED_EVENT,
    });
    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.uninstallCount[RECEIVED]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store);
  });

  it("client successfully installed deposit app, but went offline during uninstall protocol", async () => {
    client = await createClientWithMessagingLimits({
      protocol: ProtocolNames.uninstall,
      ceiling: { [SEND]: 0 },
      signer,
      store,
    });

    await makeFailingDepositCall({
      client,
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.uninstall),
      event: EventNames.UNINSTALL_FAILED_EVENT,
    });
    const messaging = client.messaging! as TestMessagingService;
    expect(messaging.uninstallCount[SEND]).to.be.eq(0);

    await recreateClientAndRetryDepositCall(signer, client, store);
  });
});
