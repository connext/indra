import { utils } from "@connext/client";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import {
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  ETH_AMOUNT_SM,
  swapAsset,
  TOKEN_AMOUNT,
  requestCollateral,
  ClientTestMessagingInputOpts,
  getMessaging,
  INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  APP_PROTOCOL_TOO_LONG,
  UNINSTALL_SUPPORTED_APP_COUNT_SENT,
  getStore,
  cleanupMessaging,
  fastForwardDuringCall,
} from "../util";
import { BigNumber } from "ethers/utils";

import * as lolex from "lolex";

const { xpubToAddress } = utils;

describe("Swap offline", () => {
  let client: IConnextClient;

  const fundChannelAndSwap = async (opts: {
    messagingConfig?: Partial<ClientTestMessagingInputOpts>;
    inputAmount: BigNumber;
    outputAmount: BigNumber;
    tokenToEth?: boolean;
    failsWith?: string;
    client?: IConnextClient;
    fastForward?: boolean;
  }) => {
    const {
      client: providedClient,
      inputAmount,
      outputAmount,
      failsWith,
      messagingConfig,
      tokenToEth,
      fastForward,
    } = opts;
    // these tests should not have collateral issues
    // so make sure they are always properly funded
    client = providedClient || (await createClientWithMessagingLimits(messagingConfig));

    const input = {
      amount: inputAmount,
      assetId: tokenToEth ? client.config.contractAddresses.Token : AddressZero,
    };
    const output = {
      amount: outputAmount,
      assetId: tokenToEth ? AddressZero : client.config.contractAddresses.Token,
    };
    await fundChannel(client, input.amount, input.assetId);
    await requestCollateral(client, output.assetId);
    // swap call back
    const swapCb = async () =>
      await swapAsset(client, input, output, xpubToAddress(client.nodePublicIdentifier));
    // try to swap, first check if test must be fast forwarded
    if (fastForward) {
      // fast forward the clock for tests with delay
      // after swapping
      await fastForwardDuringCall(89_000, swapCb, clock, failsWith);
      return;
    }

    // check if its a failure case
    if (failsWith) {
      await expect(swapCb()).to.be.rejectedWith(failsWith);
      return;
    }

    // otherwise execute cb
    await swapCb();
  };

  let clock: any;

  beforeEach(() => {
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  it("Bot A tries to install swap but there’s no response from node", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(95_000);
    // 3 app installs expected (coin balance x2, swap)
    const expectedInstallsReceived = 3 * INSTALL_SUPPORTED_APP_COUNT_RECEIVED;
    const messagingConfig = {
      ceiling: { received: expectedInstallsReceived },
      protocol: "install",
    };

    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: APP_PROTOCOL_TOO_LONG("install"),
      fastForward: true,
    });
  });

  it("Bot A installs swap app successfully but then node goes offline for uninstall", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    const expectedUninstallsReceived = 3 * UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED;
    // does not receive messages, node is offline
    const messagingConfig = {
      ceiling: { received: expectedUninstallsReceived },
      protocol: "uninstall",
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: Error: ${APP_PROTOCOL_TOO_LONG("uninstall")}`,
      fastForward: true,
    });
  });

  it("Bot A install swap app successfully but then goes offline for uninstall", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    const expectedUninstallsSent = 3 * UNINSTALL_SUPPORTED_APP_COUNT_SENT;
    // does not receive messages, node is offline
    const messagingConfig = {
      ceiling: { sent: expectedUninstallsSent },
      protocol: "uninstall",
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: Error: ${APP_PROTOCOL_TOO_LONG("uninstall")}`,
      fastForward: true,
    });
  });

  it("Bot A installs swap app successfully but then deletes store (before uninstall)", async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(95_000);
    const providedClient = await createClientWithMessagingLimits();
    const messaging = getMessaging(providedClient.publicIdentifier);
    expect(messaging).to.be.ok;
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await messaging!.subscribe(
      `indra.node.${providedClient.nodePublicIdentifier}.install.*`,
      async () => {
        // we know client has swap app installed,
        // so delete store here
        const store = getStore(providedClient.publicIdentifier);
        await store.reset();
      },
    );

    // get state channel error
    await fundChannelAndSwap({
      client: providedClient,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: "Failed to uninstall swap",
    });
  });

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
