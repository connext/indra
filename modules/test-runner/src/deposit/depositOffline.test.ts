import { IConnextClient } from "@connext/types";
import { utils } from "@connext/client";
import * as lolex from "lolex";

import {
  APP_PROTOCOL_TOO_LONG,
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  getMessaging,
  getStore,
  INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  ZERO_ZERO_ONE_ETH,
  cleanupMessaging,
  fastForwardDuringCall,
  TOKEN_AMOUNT,
} from "../util";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

const { CF_METHOD_TIMEOUT } = utils;

/**
 * Contains any deposit tests that involve the client going offline at some
 * point in the protocol.
 */
describe("Deposit offline tests", () => {
  let clock: any;
  let client: IConnextClient;

  beforeEach(() => {
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
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

  const makeDepositCall = async (opts: {
    failsWith?: string;
    amount?: BigNumber;
    assetId?: string;
  }) => {
    const { amount, assetId, failsWith } = opts;
    const defaultAmount = assetId && assetId !== AddressZero ? TOKEN_AMOUNT : ZERO_ZERO_ONE_ETH;

    if (failsWith) {
      await fastForwardDuringCall(
        89_000,
        () => fundChannel(client, amount || defaultAmount, assetId),
        clock,
        failsWith,
      );
      return;
    }

    await fundChannel(client, amount || defaultAmount, assetId);
  };

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
    client = await createClientWithMessagingLimits({
      ceiling: { received: PROPOSE_INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
      protocol: "propose",
    });

    await makeDepositCall({
      failsWith: APP_PROTOCOL_TOO_LONG("proposal"),
    });
  });

  it("client proposes deposit, but node only receives the NATS message after timeout is over", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    // cf method timeout is 90s, client will send any messages with a
    // preconfigured delay
    const CLIENT_DELAY = CF_METHOD_TIMEOUT + 1_000;
    client = await createClientWithMessagingLimits({
      delay: { sent: CLIENT_DELAY },
      protocol: "propose",
    });

    await makeDepositCall({
      failsWith: APP_PROTOCOL_TOO_LONG("proposal"),
    });
  });

  it("client proposes deposit, but node only responds after timeout is over", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    // cf method timeout is 90s, client will process any received messages
    // with a preconfigured delay
    const CLIENT_DELAY = CF_METHOD_TIMEOUT + 1_000;
    client = await createClientWithMessagingLimits({
      delay: { received: CLIENT_DELAY },
      protocol: "propose",
    });

    await makeDepositCall({
      failsWith: APP_PROTOCOL_TOO_LONG("proposal"),
    });
  });

  it("client goes offline after proposing deposit and then comes back after timeout is over", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    client = await createClientWithMessagingLimits({
      protocol: "install",
      ceiling: { received: INSTALL_SUPPORTED_APP_COUNT_RECEIVED },
    });

    await makeDepositCall({
      failsWith: "Failed to deposit",
    });
  });

  it("client proposes deposit, but then deletes their store", async function(): Promise<void> {
    // @ts-ignore
    this.timeout(105_000);
    client = await createClientWithMessagingLimits();
    const messaging = getMessaging(client.publicIdentifier);
    expect(messaging).to.be.ok;
    // on proposal accepted message, delete the store
    await messaging!.subscribe(
      `indra.node.${client.nodePublicIdentifier}.proposalAccepted.${client.multisigAddress}`,
      async () => {
        // delete the client store
        const store = getStore(client.publicIdentifier);
        await store.reset();
      },
    );
    await makeDepositCall({
      failsWith: "Failed to deposit",
    });
  });

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
