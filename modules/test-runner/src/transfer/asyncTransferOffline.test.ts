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
  fastForwardDuringCall,
  asyncTransferAsset,
  TOKEN_AMOUNT_SM,
  MESSAGE_FAILED_TO_SEND,
  FORBIDDEN_SUBJECT,
  INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  getMessaging,
  getOpts,
  createClient,
  getStore,
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
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      MESSAGE_FAILED_TO_SEND(FORBIDDEN_SUBJECT),
    );

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
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      FORBIDDEN_SUBJECT,
    );
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
    // 1 successful proposal
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
      protocol: "propose",
    });
    await fundForTransfers();

    // make the transfer call, should timeout in propose protocol
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      `Failed to send message: Request timed out`,
      [3000, 6000],
    );
  });

  it("sender installs transfer successfully, receiver installs successfully, but node is offline", async () => {
    /**
     * Should get timeout errors
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
      protocol: "install",
    });
    await fundForTransfers();

    // make the transfer call, should timeout in propose protocol
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      `Failed to send message: Request timed out`,
      [3000, 6000],
    );
  });

  it("sender installs transfer successfully, receiver install succesfully, takesAction, then goes offline", async () => {
    /**
     * Receiver will not uninstall app, but this is not a true protocol, so the
     * app should be removed from the receivers store anyways
     */
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits();
    // 2 app proposals expected (coin balance x1, transfer)
    receiverClient = await createClientWithMessagingLimits({
      ceiling: { received: 0 },
      protocol: "takeAction",
    });
    await fundForTransfers();

    // make the transfer call, should timeout in propose protocol
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      APP_PROTOCOL_TOO_LONG("takeAction"),
    );
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
    const messaging = getMessaging(senderClient.publicIdentifier);
    await messaging!.disconnect();
    // wait for transfer to finish
    await received;
    // fast forward 5 min
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
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(senderClient.freeBalanceAddress);
    // make sure the transfer is properly reclaimed
    await verifyTransfer(reconnected, { ...expected, status: "RECLAIMED" });
  });

  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action, with sender but sender is offline but then comes online later", async function() {
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
        // fast forward 5 min
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
