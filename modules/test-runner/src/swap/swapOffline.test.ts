import { utils } from "@connext/client";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { useFakeTimers } from "sinon";

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
} from "../util";
import { BigNumber } from "ethers/utils";

const { xpubToAddress } = utils;

describe(`Swap offline`, () => {
  let client: IConnextClient;

  const fundChannelAndSwap = async (opts: {
    messagingConfig?: Partial<ClientTestMessagingInputOpts>;
    inputAmount: BigNumber;
    outputAmount: BigNumber;
    tokenToEth?: boolean;
    failsWith?: string;
    client?: IConnextClient;
  }) => {
    const {
      client: providedClient,
      inputAmount,
      outputAmount,
      failsWith,
      messagingConfig,
      tokenToEth,
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
    // try to swap
    if (failsWith) {
      await expect(
        swapAsset(client, input, output, xpubToAddress(client.nodePublicIdentifier)),
      ).to.be.rejectedWith(failsWith);
    } else {
      await swapAsset(client, input, output, xpubToAddress(client.nodePublicIdentifier));
    }
  };

  let clock: any;

  beforeEach(() => {
    clock = useFakeTimers();
  });

  it.only(`Bot A tries to install swap but there’s no response from node`, async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(95_000);
    // 3 app installs expected (coin balance x2, swap)
    const expectedInstallsReceived = 3 * INSTALL_SUPPORTED_APP_COUNT_RECEIVED;
    const messagingConfig = {
      ceiling: { received: expectedInstallsReceived },
      protocol: `install`,
    };

    await clock.tickAsync(89_000);

    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: APP_PROTOCOL_TOO_LONG(`install`),
    });
  });

  it(`Bot A installs swap app successfully but then node goes offline for uninstall`, async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    const expectedUninstallsReceived = 3 * UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED;
    // does not receive messages, node is offline
    const messagingConfig = {
      ceiling: { received: expectedUninstallsReceived },
      protocol: `uninstall`,
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: Error: ${APP_PROTOCOL_TOO_LONG(`uninstall`)}`,
    });
  });

  it(`Bot A install swap app successfully but then goes offline for uninstall`, async function(): Promise<
    void
    > {
    // @ts-ignore
    this.timeout(105_000);
    const expectedUninstallsSent = 3 * UNINSTALL_SUPPORTED_APP_COUNT_SENT;
    // does not receive messages, node is offline
    const messagingConfig = {
      ceiling: { sent: expectedUninstallsSent },
      protocol: `uninstall`,
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: Error: ${APP_PROTOCOL_TOO_LONG(`uninstall`)}`,
    });
  });

  it(`Bot A installs swap app successfully but then deletes store (before uninstall)`, async function(): Promise<
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
      failsWith: `Failed to uninstall swap`,
    });
  });

  afterEach(async () => {
    await cleanupMessaging();
    clock.restore();
  });
});
