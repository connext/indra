import {
  IConnextClient,
  ProtocolNames,
  ProtocolParams,
  IChannelSigner,
  EventName,
  EventNames,
} from "@connext/types";
import { BigNumber, constants } from "ethers";

import {
  APP_PROTOCOL_TOO_LONG,
  ClientTestMessagingInputOpts,
  createClientWithMessagingLimits,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  RECEIVED,
  requestCollateral,
  SEND,
  swapAsset,
  TestMessagingService,
  TOKEN_AMOUNT,
  UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED,
  UNINSTALL_SUPPORTED_APP_COUNT_SENT,
  env,
  CLIENT_INSTALL_FAILED,
} from "../util";
import { addressBook } from "@connext/contracts";
import { getRandomChannelSigner, delay } from "@connext/utils";

const { AddressZero } = constants;

const fundChannelAndSwap = async (opts: {
  messagingConfig?: Partial<ClientTestMessagingInputOpts>;
  inputAmount: BigNumber;
  outputAmount: BigNumber;
  tokenToEth?: boolean;
  failsWith?: string;
  failureEvent?: EventName;
  client?: IConnextClient;
  signer?: IChannelSigner;
  balanceUpdatedWithoutRetry?: boolean;
}) => {
  const {
    client: providedClient,
    signer: providedSigner,
    inputAmount,
    outputAmount,
    failsWith,
    failureEvent,
    messagingConfig,
    tokenToEth,
    balanceUpdatedWithoutRetry,
  } = opts;
  // these tests should not have collateral issues
  // so make sure they are always properly funded
  const signer = providedSigner || getRandomChannelSigner(env.ethProviderUrl);
  const client =
    providedClient || (await createClientWithMessagingLimits({ ...messagingConfig, signer }));

  const input = {
    amount: inputAmount,
    assetId: tokenToEth ? client.config.contractAddresses.Token! : AddressZero,
  };
  const output = {
    amount: outputAmount,
    assetId: tokenToEth ? AddressZero : client.config.contractAddresses.Token!,
  };
  await fundChannel(client, input.amount, input.assetId);
  await requestCollateral(client, output.assetId);
  const preSwapFb = await client.getFreeBalance(output.assetId);

  // check if its a failure case
  if (failsWith) {
    if (!failureEvent) {
      await expect(swapAsset(client, input, output, client.nodeSignerAddress)).to.be.rejectedWith(
        failsWith,
      );
    } else {
      await new Promise(async (resolve, reject) => {
        client.once(failureEvent as any, (msg) => {
          try {
            expect(msg.params).to.be.an("object");
            expect(msg.error).to.include(failsWith);
            return resolve(msg);
          } catch (e) {
            return reject(e.message);
          }
        });
        try {
          await expect(
            swapAsset(client, input, output, client.nodeSignerAddress),
          ).to.be.rejectedWith(failsWith);
        } catch (e) {
          return reject(e);
        }
      });
    }
    await client.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);
    // recreate client and retry swap after failure
    const recreated = await createClientWithMessagingLimits({ signer, store: client.store });
    if (balanceUpdatedWithoutRetry) {
      // happens for cases where the registry app should be cleaned on connect
      const postFb = await recreated.getFreeBalance(output.assetId);
      expect(postFb[recreated.signerAddress].gt(preSwapFb[recreated.signerAddress])).to.be.true;
      return;
    }
    await swapAsset(recreated, input, output, recreated.nodeSignerAddress);
    return;
  }

  // otherwise execute cb
  await swapAsset(client, input, output, client.nodeSignerAddress);
};

describe.skip("Swap offline", () => {
  const swapAppAddr = addressBook[1337].SimpleTwoPartySwapApp.address;
  it("Bot A tries to propose swap app, but gets no response from the node", async () => {
    const messagingConfig = {
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.propose,
      params: { appDefinition: swapAppAddr },
    };

    // deposit eth into channel and swap for token
    // go offline during swap, should fail with a reject install
    // timeout (IO_SEND_AND_WAIT on node)
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      failureEvent: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    });
  });

  it("Bot A successfully proposes swap app, but goes offline before install protocol begins", async () => {
    const messagingConfig = {
      ceiling: { [RECEIVED]: 0 },
      protocol: ProtocolNames.install,
      params: ({
        appInterface: { addr: swapAppAddr },
      } as unknown) as ProtocolParams.Install,
    };

    // deposit eth into channel and swap for token
    // go offline during swap, should fail with a reject install
    // timeout (IO_SEND_AND_WAIT on node)
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: CLIENT_INSTALL_FAILED(true),
    });
  });

  it("Bot A installs swap app successfully but goes offline for uninstall", async () => {
    // does not receive messages, node is offline
    const count = UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED + UNINSTALL_SUPPORTED_APP_COUNT_SENT + 2;
    const messagingConfig = {
      ceiling: { [RECEIVED]: count },
      protocol: ProtocolNames.uninstall,
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: APP_PROTOCOL_TOO_LONG("uninstall"),
      failureEvent: EventNames.UNINSTALL_FAILED_EVENT,
      balanceUpdatedWithoutRetry: true,
    });
  });

  it("Bot A install swap app successfully but node goes offline for uninstall", async () => {
    // does not receive messages, node is offline
    const count = UNINSTALL_SUPPORTED_APP_COUNT_RECEIVED + UNINSTALL_SUPPORTED_APP_COUNT_SENT + 2;
    const messagingConfig = {
      ceiling: { [SEND]: count },
      protocol: ProtocolNames.uninstall,
    };
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await fundChannelAndSwap({
      messagingConfig,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: ${APP_PROTOCOL_TOO_LONG("uninstall")}`,
      balanceUpdatedWithoutRetry: true,
    });
  });

  it("Bot A installs swap app successfully but then deletes store before uninstall", async () => {
    const signer = getRandomChannelSigner(env.ethProviderUrl);
    const providedClient = await createClientWithMessagingLimits({ signer });
    expect(providedClient.messaging).to.be.ok;
    // deposit eth into channel and swap for token
    // go offline during swap, should fail with swap timeout
    await (providedClient.messaging as TestMessagingService)!.subscribe(
      `${providedClient.nodeIdentifier}.channel.${providedClient.multisigAddress}.app-instance.*.install`,
      async (msg: any) => {
        const { appDefinition } = msg.data;
        if (appDefinition !== swapAppAddr) {
          return;
        }
        // we know client has swap app installed,
        // so delete store here
        await providedClient.store.clear();
      },
    );

    // get state channel error
    await fundChannelAndSwap({
      client: providedClient,
      signer,
      inputAmount: ETH_AMOUNT_SM,
      outputAmount: TOKEN_AMOUNT,
      failsWith: `Failed to uninstall swap: Error: Call to getStateChannel failed`,
      balanceUpdatedWithoutRetry: true,
    });
  });
});
