import { utils } from "@connext/client";

import {
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  getMessaging,
  getStore,
  ZERO_ZERO_ONE_ETH,
} from "../util";

const { CF_METHOD_TIMEOUT } = utils;

/**
 * Contains any deposit tests that involve the client going offline at some
 * point in the protocol.
 */
describe.skip("Deposit offline tests", () => {
  /**
   * In this case, the client correctly stops processing received messages
   * so the `proposeInstallApp` call never resolves. However, the node *does*
   * receive the NATS message for the `propose` call so the promise is
   * `resolved`. More importantly, at the protocol level the responders store
   * in the `propose` protocol can be incorrectly updated (ie. proposal is added
   * before it is completed by both parties) if the `initiator` goes offline
   * after sending m1
   */
  it("client proposes deposit, but node doesn't receive the NATS message (or no response from node)", async function(): Promise<
    void
  > {
    // @ts-ignore
    this.timeout(100_000);
    // create client where the propose protocol will not complete
    // in deposit, client will propose the `CoinBalanceRefund` app (is the
    // initiator in the `propose` protocol)
    // in the propose protocol, the initiator sends one message, and receives
    // one message, set the cap at 1 for `propose` in messaging of client
    const client = await createClientWithMessagingLimits({
      ceiling: { received: 1 },
      protocol: "propose",
    });
    await expect(fundChannel(client, ZERO_ZERO_ONE_ETH)).to.be.rejectedWith(
      `App proposal took longer than 90 seconds`,
    );
  });

  it("client proposes deposit, but node only receives the NATS message after timeout is over", async function(): Promise<
    void
  > {
    // @ts-ignore
    this.timeout(105_000);
    // cf method timeout is 90s, client will send any messages with a
    // preconfigured delay
    const CLIENT_DELAY = CF_METHOD_TIMEOUT + 1_000;
    const client = await createClientWithMessagingLimits({
      delay: { sent: CLIENT_DELAY },
      protocol: "propose",
    });
    await expect(fundChannel(client, ZERO_ZERO_ONE_ETH)).to.be.rejectedWith(
      `App proposal took longer than 90 seconds`,
    );
  });

  it("client proposes deposit, but node only responds after timeout is over", async function(): Promise<
    void
  > {
    // @ts-ignore
    this.timeout(105_000);
    // cf method timeout is 90s, client will process any received messages
    // with a preconfigured delay
    const CLIENT_DELAY = CF_METHOD_TIMEOUT + 1_000;
    const client = await createClientWithMessagingLimits({
      delay: { received: CLIENT_DELAY },
      protocol: "propose",
    });
    await expect(fundChannel(client, ZERO_ZERO_ONE_ETH)).to.be.rejectedWith(
      `App proposal took longer than 90 seconds`,
    );
  });

  it("client goes offline after proposing deposit and then comes back after timeout is over", async function(): Promise<
    void
  > {
    // @ts-ignore
    this.timeout(105_000);
    const client = await createClientWithMessagingLimits({
      protocol: "install",
      ceiling: { received: 1 },
    });
    await expect(fundChannel(client, ZERO_ZERO_ONE_ETH)).to.be.rejectedWith(`Failed to deposit`);
  });

  it("client proposes deposit, but then deletes their store", async function(): Promise<void> {
    // @ts-ignore
    this.timeout(105_000);
    const client = await createClientWithMessagingLimits({
      protocol: "install",
      ceiling: { received: 1 },
    });
    const messaging = getMessaging();
    expect(messaging).to.be.ok;
    // on proposal accepted message, delete the store
    await messaging!.subscribe(
      `indra.node.${client.nodePublicIdentifier}.proposalAccepted.${client.multisigAddress}`,
      async () => {
        // delete the client store
        const store = getStore();
        await store.reset();
      },
    );
    await expect(fundChannel(client, ZERO_ZERO_ONE_ETH)).to.be.rejectedWith(`Failed to deposit`);
  });
});
