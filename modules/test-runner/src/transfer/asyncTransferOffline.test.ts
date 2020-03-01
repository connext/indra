import {
  IConnextClient,
  DefaultApp,
  RECIEVE_TRANSFER_FINISHED_EVENT,
  UPDATE_STATE_EVENT,
} from "@connext/types";
import * as lolex from "lolex";

import {
  APP_PROTOCOL_TOO_LONG,
  asyncTransferAsset,
  createClient,
  createClientWithMessagingLimits,
  delay,
  expect,
  FORBIDDEN_SUBJECT_ERROR,
  fundChannel,
  getMnemonic,
  getProtocolFromData,
  MesssagingEventData,
  PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  RECEIVED,
  REQUEST,
  requestCollateral,
  SUBJECT_FORBIDDEN,
  TestMessagingService,
  TOKEN_AMOUNT,
  TOKEN_AMOUNT_SM,
} from "../util";
import { BigNumber } from "ethers/utils";
import { Client } from "ts-nats";
import { connectNats, closeNats } from "../util/nats";
import { before, after } from "mocha";

const fundForTransfers = async (
  receiverClient: IConnextClient,
  senderClient: IConnextClient,
  amount: BigNumber = TOKEN_AMOUNT,
  assetId?: string,
): Promise<void> => {
  // make sure the tokenAddress is set
  const tokenAddress = senderClient.config.contractAddresses.Token;
  await fundChannel(senderClient, amount, assetId || tokenAddress);
  await requestCollateral(receiverClient, assetId || tokenAddress);
};

const getLinkedApp = async (client: IConnextClient, onlyOne: boolean = true): Promise<any> => {
  const registeredApp = client.appRegistry.filter(
    (app: DefaultApp) => app.name === "SimpleLinkedTransferApp",
  )[0];
  const linkedApps = (await client.getAppInstances()).filter(
    app => app.appInterface.addr === registeredApp.appDefinitionAddress,
  );
  // make sure the state is correct
  if (onlyOne) {
    expect(linkedApps.length).to.be.equal(1);
    return linkedApps[0];
  }
  expect(linkedApps).to.be.ok;
  return linkedApps;
};

const verifyTransfer = async (
  client: IConnextClient,
  expected: any, //Partial<Transfer> type uses `null` not `undefined`
): Promise<void> => {
  expect(expected.paymentId).to.be.ok;
  const transfer = await client.getLinkedTransfer(expected.paymentId);
  // verify the saved transfer information
  expect(transfer).to.containSubset(expected);
};

describe("Async transfer offline tests", () => {
  let clock: any;
  let senderClient: IConnextClient;
  let receiverClient: IConnextClient;
  let nats: Client;

  before(async () => {
    nats = await connectNats();
  });

  beforeEach(async () => {
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  afterEach(async () => {
    clock && clock.reset && clock.reset();
    await senderClient.messaging.disconnect();
    await receiverClient.messaging.disconnect();
  });

  after(() => {
    closeNats();
  });

  /**
   * Will have a transfer saved on the hub, but nothing sent to recipient.
   *
   * Recipient should be able to claim payment regardless.
   */
  it("sender successfully installs transfer, goes offline before sending paymentId/preimage, and stays offline", async () => {
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({
      forbiddenSubjects: [`transfer.send-async.`],
    });
    receiverClient = await createClientWithMessagingLimits();
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    // make the transfer call, should fail when sending info to node, but
    // will retry. fast forward through NATS_TIMEOUT
    (senderClient.messaging as TestMessagingService).on(SUBJECT_FORBIDDEN, () => {
      // fast forward here
      clock.tick(89_000);
    });
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress, nats),
    ).to.be.rejectedWith(FORBIDDEN_SUBJECT_ERROR);
    // make sure that the app is installed with the hub/sender
    const senderLinkedApp = await getLinkedApp(senderClient);
    const { paymentId } = senderLinkedApp.latestState as any;
    // verify the saved transfer information
    const expectedTransfer = {
      amount: TOKEN_AMOUNT_SM.toString(),
      receiverPublicIdentifier: receiverClient.publicIdentifier,
      paymentId,
      senderPublicIdentifier: senderClient.publicIdentifier,
      status: "PENDING",
      type: "LINKED",
    };
    await verifyTransfer(senderClient, expectedTransfer);
    const receiverLinkedApp = await getLinkedApp(receiverClient, false);
    expect(receiverLinkedApp.length).to.equal(0);
    // make sure recipient can still redeem payment
    await receiverClient.reclaimPendingAsyncTransfers();
    await verifyTransfer(receiverClient, { ...expectedTransfer, status: "REDEEMED" });
  });

  /**
   * Should get timeout errors.
   *
   * Client calls `resolve` on node, node will install and propose, client
   * will take action with recipient.
   */
  it("sender installs transfer successfully, receiver proposes install but node is offline", async () => {
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    // 1 successful proposal (balance refund)
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
      protocol: "propose",
    });
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    (receiverClient.messaging as TestMessagingService).on(
      REQUEST,
      async (msg: MesssagingEventData) => {
        const { subject } = msg;
        if (subject!.includes(`resolve`)) {
          // wait for message to be sent, event is fired first
          await delay(500);
          clock.tick(89_000);
        }
      },
    );
    // make the transfer call, should timeout in propose protocol
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress, nats),
    ).to.be.rejectedWith(`Failed to send message: Request timed out`);
  });

  /**
   * Should get timeout errors
   */
  it("sender installs transfer successfully, receiver installs successfully, but node is offline for take action (times out)", async () => {
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: 0 },
      protocol: "takeAction",
    });
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    (receiverClient.messaging as TestMessagingService).on(
      RECEIVED,
      async (msg: MesssagingEventData) => {
        if (getProtocolFromData(msg) === "takeAction") {
          clock.tick(89_000);
        }
      },
    );
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress, nats),
    ).to.be.rejectedWith(APP_PROTOCOL_TOO_LONG("takeAction"));
  });

  /**
   * Expected behavior: sender should still have app (with money owed to
   * them) installed in the channel when they come back online
   *
   * Ideally, the node takes action +  uninstalls these apps on `connect`,
   * and money is returned to the hubs channel (redeemed payment)
   */
  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action with sender but sender is offline but then comes online later", async () => {
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    receiverClient = await createClientWithMessagingLimits();
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    // transfer from the sender to the receiver, then take the
    // sender offline
    const received = new Promise(resolve =>
      receiverClient.once(RECIEVE_TRANSFER_FINISHED_EVENT, () => {
        resolve();
      }),
    );
    const { paymentId } = await senderClient.transfer({
      amount: TOKEN_AMOUNT_SM.toString(),
      assetId: tokenAddress,
      recipient: receiverClient.publicIdentifier,
    });
    // immediately take sender offline
    await (senderClient.messaging as TestMessagingService).disconnect();
    // wait for transfer to finish
    await received;
    // fast forward 3 min, so any protocols are expired for the client
    clock.tick(60_000 * 3);
    // verify transfer
    const expected = {
      amount: TOKEN_AMOUNT_SM.toString(),
      receiverPublicIdentifier: receiverClient.publicIdentifier,
      paymentId,
      senderPublicIdentifier: senderClient.publicIdentifier,
      status: "REDEEMED",
      type: "LINKED",
      assetId: tokenAddress,
    };
    await verifyTransfer(receiverClient, expected);
    // reconnect the sender
    const reconnected = await createClient({
      mnemonic: getMnemonic(senderClient.publicIdentifier),
      store: senderClient.store,
    });
    // NOTE: fast forwarding does not propagate to node timers
    // so when `reconnected comes online, there is still a 90s
    // timer locked on the multisig address + appId (trying to
    // take action) and uninstall app (this is why this test has
    // an extended timeout)
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(senderClient.freeBalanceAddress);
    // make sure the transfer is properly reclaimed
    await delay(5000);
    await verifyTransfer(reconnected, { ...expected, status: "RECLAIMED" });
  });

  /**
   * Expected behavior: sender should still have app (with money owed to
   * them) installed in the channel when they come back online
   *
   * Ideally, the node takes action +  uninstalls these apps on `connect`,
   * and money is returned to the hubs channel (redeemed payment)
   */
  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action, with sender but sender is offline but then comes online later", async () => {
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({
      ceiling: { sent: 1 }, // for deposit app
      protocol: "uninstall",
    });
    receiverClient = await createClientWithMessagingLimits();
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    // transfer from the sender to the receiver, then take the
    // sender offline
    const received = new Promise((resolve: Function) =>
      receiverClient.once(RECIEVE_TRANSFER_FINISHED_EVENT, () => {
        resolve();
      }),
    );
    // disconnect messaging on take action event
    const actionTaken = new Promise((resolve: Function) => {
      senderClient.once(UPDATE_STATE_EVENT, async () => {
        await received;
        await (senderClient.messaging as TestMessagingService).disconnect();
        // fast forward 3 min so protocols are stale on client
        clock.tick(60_000 * 3);
        resolve();
      });
    });
    const { paymentId } = await senderClient.transfer({
      amount: TOKEN_AMOUNT_SM.toString(),
      assetId: tokenAddress,
      recipient: receiverClient.publicIdentifier,
    });
    // wait for transfer to finish + messaging to be disconnected
    await actionTaken;
    // verify transfer
    const expected = {
      amount: TOKEN_AMOUNT_SM.toString(),
      receiverPublicIdentifier: receiverClient.publicIdentifier,
      paymentId,
      senderPublicIdentifier: senderClient.publicIdentifier,
      status: "REDEEMED",
      type: "LINKED",
    };
    await verifyTransfer(receiverClient, expected);
    // reconnect the sender
    const reconnected = await createClient({
      mnemonic: getMnemonic(senderClient.publicIdentifier),
    });
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(senderClient.freeBalanceAddress);
    // make sure the transfer is properly reclaimed
    await verifyTransfer(reconnected, { ...expected, status: "RECLAIMED" });
  });
});
