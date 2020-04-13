import {
  delay,
  EventNames,
  IConnextClient,
  LinkedTransferStatus,
} from "@connext/types";
import * as lolex from "lolex";

import {
  APP_PROTOCOL_TOO_LONG,
  asyncTransferAsset,
  createClient,
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  getProtocolFromData,
  MessagingEventData,
  PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  RECEIVED,
  REQUEST,
  requestCollateral,
  TestMessagingService,
  TOKEN_AMOUNT,
  TOKEN_AMOUNT_SM,
  getNatsClient,
} from "../util";
import { BigNumber } from "ethers/utils";
import { Client } from "ts-nats";
import { before } from "mocha";
import { Wallet } from "ethers";

const fundForTransfers = async (
  receiverClient: IConnextClient,
  senderClient: IConnextClient,
  amount: BigNumber = TOKEN_AMOUNT,
  assetId?: string,
): Promise<void> => {
  // make sure the tokenAddress is set
  const tokenAddress = senderClient.config.contractAddresses.Token;
  await fundChannel(senderClient, amount, assetId || tokenAddress);
  await requestCollateral(receiverClient, assetId || tokenAddress, true);
};

const verifyTransfer = async (
  client: IConnextClient,
  expected: any, //Partial<Transfer> type uses `null` not `undefined`
): Promise<void> => {
  expect(expected.paymentId).to.be.ok;
  const transfer = await client.getLinkedTransfer(expected.paymentId);
  // verify the saved transfer information
  expect(transfer).to.containSubset(expected);
  expect(transfer.encryptedPreImage).to.be.ok;
};

describe("Async transfer offline tests", () => {
  let clock: any;
  let senderClient: IConnextClient;
  let receiverClient: IConnextClient;
  let nats: Client;

  before(async () => {
    nats = getNatsClient();
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

  /**
   * Should get timeout errors.
   *
   * Client calls `resolve` on node, node will install and propose, client
   * will take action with recipient.
   */
  it.skip("sender installs transfer successfully, receiver proposes install but node is offline", async () => {
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
      async (msg: MessagingEventData) => {
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
      async (msg: MessagingEventData) => {
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
  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action with sender but sender is offline but then comes online later (sender offline for take action)", async () => {
    const senderPk = Wallet.createRandom().privateKey;
    const receiverPk = Wallet.createRandom().privateKey;
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({ signer: senderPk });
    receiverClient = await createClientWithMessagingLimits({ signer: receiverPk });
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);
    // transfer from the sender to the receiver, then take the
    // sender offline
    const received = new Promise(resolve =>
      receiverClient.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve),
    );
    const { paymentId } = await senderClient.transfer({
      amount: TOKEN_AMOUNT_SM,
      assetId: tokenAddress,
      recipient: receiverClient.publicIdentifier,
    });
    const senderApps = await senderClient.getAppInstances();
    // immediately take sender offline
    await (senderClient.messaging as TestMessagingService).disconnect();
    // wait for transfer to finish
    await received;
    // verify transfer
    const expected = {
      amount: TOKEN_AMOUNT_SM,
      receiverIdentifier: receiverClient.publicIdentifier,
      paymentId,
      senderIdentifier: senderClient.publicIdentifier,
      status: LinkedTransferStatus.COMPLETED,
      assetId: tokenAddress,
    };
    await verifyTransfer(receiverClient, expected);
    // reconnect the sender
    const reconnected = await createClient({
      signer: senderPk,
      store: senderClient.store,
    });
    // NOTE: fast forwarding does not propagate to node timers
    // so when `reconnected comes online, there is still a 90s
    // timer locked on the multisig address + appIdentityHash (trying to
    // take action) and uninstall app (this is why this test has
    // an extended timeout)
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.signerAddress).to.be.equal(senderClient.signerAddress);
    // make sure the transfer is properly reclaimed
    const reconnectedApps = await senderClient.getAppInstances();
    expect(reconnectedApps.length).to.be.equal(senderApps.length - 1);
    // make sure the transfer is properly returned
    await verifyTransfer(reconnected, expected);
  });

  /**
   * Expected behavior: sender should still have app (with money owed to
   * them) installed in the channel when they come back online
   *
   * Ideally, the node takes action +  uninstalls these apps on `connect`,
   * and money is returned to the hubs channel (redeemed payment)
   */
  it("sender installs, receiver installs, takesAction, then uninstalls. Node takes action with sender then tries to uninstall, but sender is offline then comes online later (sender offline for uninstall)", async () => {
    const senderPk = Wallet.createRandom().privateKey;
    const receiverPk = Wallet.createRandom().privateKey;
    // create the sender client and receiver clients + fund
    senderClient = await createClientWithMessagingLimits({
      ceiling: { sent: 1 }, // for deposit app
      protocol: "uninstall",
      signer: senderPk,
    });
    receiverClient = await createClientWithMessagingLimits({ signer: receiverPk });
    const tokenAddress = senderClient.config.contractAddresses.Token;
    await fundForTransfers(receiverClient, senderClient);

    // disconnect messaging on take action event, ensuring transfer received
    const transferCompleteAndActionTaken = Promise.all([
      new Promise((resolve: Function) =>
        receiverClient.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, () => {
          resolve();
        }),
      ),
      new Promise((resolve: Function) => {
        senderClient.once(EventNames.UPDATE_STATE_EVENT, async () => {
          await senderClient.messaging.disconnect();
          resolve();
        });
      }),
    ]);

    const senderApps = await senderClient.getAppInstances();
    const { paymentId } = await senderClient.transfer({
      amount: TOKEN_AMOUNT_SM,
      assetId: tokenAddress,
      recipient: receiverClient.publicIdentifier,
    });
    // wait for transfer to finish + messaging to be disconnected
    await transferCompleteAndActionTaken;
    // verify transfer
    const expected = {
      amount: TOKEN_AMOUNT_SM,
      assetId: tokenAddress,
      receiverIdentifier: receiverClient.publicIdentifier,
      paymentId,
      senderIdentifier: senderClient.publicIdentifier,
      status: LinkedTransferStatus.COMPLETED,
    };
    await verifyTransfer(receiverClient, expected);
    // fast forward 3 min so protocols are stale on client
    clock.tick(60_000 * 3);
    // reconnect the sender
    const reconnected = await createClient({
      signer: senderPk,
      store: senderClient.store,
    });
    expect(reconnected.publicIdentifier).to.be.equal(senderClient.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(senderClient.multisigAddress);
    expect(reconnected.signerAddress).to.be.equal(senderClient.signerAddress);
    // make sure the transfer is properly reclaimed
    const reconnectedApps = await senderClient.getAppInstances();
    expect(reconnectedApps.length).to.be.equal(senderApps.length);
    // make sure the transfer is properly returned
    await verifyTransfer(reconnected, expected);
  });
});
