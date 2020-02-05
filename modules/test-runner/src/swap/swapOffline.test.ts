import { utils } from "@connext/client";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import {
  APP_PROTOCOL_TOO_LONG,
  ClientTestMessagingInputOpts,
  createClientWithMessagingLimits,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  getProtocolFromData,
  INSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  MessagingEvent,
  MesssagingEventData,
  RECEIVED,
  requestCollateral,
  SEND,
  swapAsset,
  TestMessagingService,
  TOKEN_AMOUNT,
  UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  UNINSTALL_SUPPORTED_APP_COUNT_SENT,
} from "../util";
import { BigNumber } from "ethers/utils";

import * as lolex from "lolex";

const { xpubToAddress } = utils;

let clock: any;

const fundChannelAndSwap = async (opts: {
  messagingConfig?: Partial<ClientTestMessagingInputOpts>;
  inputAmount: BigNumber;
  outputAmount: BigNumber;
  tokenToEth?: boolean;
  failsWith?: string;
  client?: IConnextClient;
  fastForward?: MessagingEvent;
  protocol?: string;
}) => {
  const {
    client: providedClient,
    inputAmount,
    outputAmount,
    failsWith,
    messagingConfig,
    tokenToEth,
    fastForward,
    protocol,
  } = opts;
  // these tests should not have collateral issues
  // so make sure they are always properly funded
  const client = providedClient || (await createClientWithMessagingLimits(messagingConfig));

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
    (client.messaging as TestMessagingService)!.on(
      fastForward,
      async (msg: MesssagingEventData) => {
        // check if you should fast forward on specific protocol, or
        // just on specfic subject
        if (!protocol) {
          clock.tick(89_000);
          return;
        }
        if (getProtocolFromData(msg) === protocol) {
          clock.tick(89_000);
          return;
        }
      },
    );
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

describe("Swap offline", () => {
  beforeEach(() => {
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  afterEach(async () => {
    clock && clock.reset && clock.reset();
  });

  it("Bot A tries to install swap but there’s no response from node", async () => {
    // 3 app installs expected (coin balance x2, swap)
    const expectedInstallsReceived = 2 * INSTALL_SUPPORTED_APP_COUNT_RECEIVED;
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
      fastForward: RECEIVED,
      protocol: "install",
    });
  });

  it("Bot A installs swap app successfully but then node goes offline for uninstall", async () => {
    const expectedUninstallsReceived = 2 * UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED;
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
      fastForward: RECEIVED,
      protocol: "uninstall",
    });
  });

  it("Bot A install swap app successfully but then goes offline for uninstall", async () => {
    const expectedUninstallsSent = 2 * UNINSTALL_SUPPORTED_APP_COUNT_SENT;
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
      fastForward: SEND,
      protocol: "uninstall",
    });
  });

  it("Bot A installs swap app successfully but then deletes store (before uninstall)", async () => {
    const providedClient = await createClientWithMessagingLimits();
    expect(providedClient.messaging).to.be.ok;
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await (providedClient.messaging as TestMessagingService)!.subscribe(
      `indra.node.${providedClient.nodePublicIdentifier}.install.*`,
      async () => {
        // we know client has swap app installed,
        // so delete store here
        await providedClient.store.reset!();
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
});
