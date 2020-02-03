import {
  IConnextClient,
  DefaultApp,
  RECIEVE_TRANSFER_FINISHED_EVENT,
  UPDATE_STATE_EVENT,
} from "@connext/types";
import * as lolex from "lolex";

import {
  APP_PROTOCOL_TOO_LONG,
  expect,
  cleanupMessaging,
  createClientWithMessagingLimits,
  TOKEN_AMOUNT,
  fundChannel,
  requestCollateral,
  asyncTransferAsset,
  TOKEN_AMOUNT_SM,
  FORBIDDEN_SUBJECT_ERROR,
  PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  getMessaging,
  getOpts,
  createClient,
  getStore,
  RECEIVED,
  MesssagingEventData,
  getProtocolFromData,
  REQUEST,
  delay,
  SUBJECT_FORBIDDEN,
} from "../util";
import { BigNumber } from "ethers/utils";

describe("Async transfer offline tests", () => {
  let clock: any;
  let senderClient: IConnextClient;
  let receiverClient: IConnextClient;
  let tokenAddress: string;

  /////////////////////////////////
  /// TEST SPECIFIC HELPERS
  const fundForTransfers = async (
    amount: BigNumber = TOKEN_AMOUNT,
    assetId?: string,
  ): Promise<void> => {
    // make sure the tokenAddress is set
    tokenAddress = senderClient.config.contractAddresses.Token;
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
    const transfer = await client.getLinkedTransfer(expected.paymentId!);
    // verify the saved transfer information
    expect(transfer).to.containSubset(expected);
  };

  beforeEach(async () => {
    // create the clock
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  it("sender successfully installs transfer, goes offline before sending paymentId or preimage, then comes online and has the pending installed transfer", async () => {
    /**
     * In this case, node will not know the recipient or encrypted preimage,
     * the transfer to recipient is essentially installed as an unclaimable
     * (i.e. preImage lost) linked transfer without a specified recipient.
     *
     * Avoid `transfer.set-recipient.${this.userPublicIdentifier}` endpoint
     * with the hub. The hub should clean these up during disputes
     */

    // create the sender client and receiver clients
    senderClient = await createClientWithMessagingLimits({
      forbiddenSubjects: [`transfer.set-recipient`],
    });
    receiverClient = await createClientWithMessagingLimits();

    // fund the channels
    await fundForTransfers();

    // make the transfer call, should fail when sending info to node, but
    // will retry. fast forward through NATS_TIMEOUT
    const senderMessaging = getMessaging(senderClient.publicIdentifier);
    senderMessaging!.on(SUBJECT_FORBIDDEN, () => {
      // fast forward here
      clock.tick(89_000);
    });
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
    ).to.be.rejectedWith(FORBIDDEN_SUBJECT_ERROR);

    // make sure that the app is installed with the hub/sender
    const senderLinkedApp = await getLinkedApp(senderClient);
    const { paymentId } = senderLinkedApp.latestState as any;
    // verify the saved transfer information
    await verifyTransfer(senderClient, {
      amount: TOKEN_AMOUNT_SM.toString(),
      receiverPublicIdentifier: null,
      paymentId,
      senderPublicIdentifier: senderClient.publicIdentifier,
      status: "PENDING",
      type: "LINKED",
    });
    const receiverLinkedApp = await getLinkedApp(receiverClient, false);
    expect(receiverLinkedApp.length).to.equal(0);
  });

  it("sender successfully installs transfer, goes offline before sending paymentId/preimage, and stays offline", async () => {
    /**
     * Will have a transfer saved on the hub, but nothing sent to recipient.
     *
     * Recipient should be able to claim payment regardless.
     */

    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({
      forbiddenSubjects: [`transfer.send-async.`],
    });
    receiverClient = await createClientWithMessagingLimits();
    await fundForTransfers();

    // make the transfer call, should fail when sending info to node, but
    // will retry. fast forward through NATS_TIMEOUT
    const senderMessaging = getMessaging(senderClient.publicIdentifier);
    senderMessaging!.on(SUBJECT_FORBIDDEN, () => {
      // fast forward here
      clock.tick(89_000);
    });
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
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

  it("sender installs transfer successfully, receiver proposes install but node is offline", async () => {
    /**
     * Should get timeout errors.
     *
     * Client calls `resolve` on node, node will install and propose, client
     * will take action with recipient.
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    // 1 successful proposal (balance refund)
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
      protocol: "propose",
    });
    await fundForTransfers();
    const receiverMessaging = getMessaging(receiverClient.publicIdentifier);
    receiverMessaging!.on(REQUEST, async (msg: MesssagingEventData) => {
      const { subject } = msg;
      if (subject!.includes(`resolve`)) {
        // wait for message to be sent, event is fired first
        await delay(500);
        clock.tick(89_000);
      }
    });

    // make the transfer call, should timeout in propose protocol
    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
    ).to.be.rejectedWith(`Failed to send message: Request timed out`);
  });

  it("sender installs transfer successfully, receiver installs successfully, but node is offline for take action (times out)", async () => {
    /**
     * Should get timeout errors
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: 0 },
      protocol: "takeAction",
    });
    await fundForTransfers();

    const receiverMessaging = getMessaging(receiverClient.publicIdentifier);
    receiverMessaging!.on(RECEIVED, async (msg: MesssagingEventData) => {
      if (getProtocolFromData(msg) === "takeAction") {
        clock.tick(89_000);
      }
    });

    await expect(
      asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
    ).to.be.rejectedWith(APP_PROTOCOL_TOO_LONG("takeAction"));
  });

  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action with sender but sender is offline but then comes online later", async function() {
    this.timeout(130_000);
    /**
     * Expected behavior: sender should still have app (with money owed to
     * them) installed in the channel when they come back online
     *
     * Ideally, the node takes action +  uninstalls these apps on `connect`,
     * and money is returned to the hubs channel (redeemed payment)
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    receiverClient = await createClientWithMessagingLimits();
    await fundForTransfers();

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
    const senderMessaging = getMessaging(senderClient.publicIdentifier);
    await senderMessaging!.disconnect();
    // wait for transfer to finish
    await received;
    // fast forward 5 min, so any protocols are expired for the client
    clock.tick(60_000 * 5);
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
    const { mnemonic } = getOpts(senderClient.publicIdentifier);
    const reconnected = await createClient({
      mnemonic,
      store: getStore(senderClient.publicIdentifier),
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
    await verifyTransfer(reconnected, { ...expected, status: "RECLAIMED" });
  });

  // TODO: Passes independently, but when run with all the integration tests
  // fails with: `Uncaught NatsError: 'Stale Connection'`
  it.skip("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action, with sender but sender is offline but then comes online later", async function() {
    this.timeout(200_000);
    /**
     * Expected behavior: sender should still have app (with money owed to
     * them) installed in the channel when they come back online
     *
     * Ideally, the node takes action +  uninstalls these apps on `connect`,
     * and money is returned to the hubs channel (redeemed payment)
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({
      ceiling: { sent: 1 }, // for deposit app
      protocol: "uninstall",
    });
    receiverClient = await createClientWithMessagingLimits();
    await fundForTransfers();

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
        const messaging = getMessaging(senderClient.publicIdentifier);
        await messaging!.disconnect();
        // fast forward 5 min so protocols are stale on client
        clock.tick(60_000 * 5);
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
    const { mnemonic } = getOpts(senderClient.publicIdentifier);
    const reconnected = await createClient({
      mnemonic,
    });
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(senderClient.freeBalanceAddress);
    // make sure the transfer is properly reclaimed
    await verifyTransfer(reconnected, { ...expected, status: "RECLAIMED" });
  });

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
