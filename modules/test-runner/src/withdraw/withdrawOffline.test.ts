import {
  EventNames,
  IConnextClient,
  IChannelSigner,
  CF_METHOD_TIMEOUT,
  IClientStore,
  ProtocolNames,
} from "@connext/types";
import { delay, getRandomChannelSigner } from "@connext/utils";
import { BigNumber } from "ethers/utils";
import { AddressZero } from "ethers/constants";
import * as lolex from "lolex";
import {
  ClientTestMessagingInputOpts,
  createClient,
  createClientWithMessagingLimits,
  ETH_AMOUNT_SM,
  ethProvider,
  expect,
  fundChannel,
  getProtocolFromData,
  MessagingEventData,
  RECEIVED,
  SEND,
  TestMessagingService,
  withdrawFromChannel,
  ZERO_ZERO_ZERO_FIVE_ETH,
  env,
  getParamsFromData,
} from "../util";
import { addressBook } from "@connext/contracts";
import { getMemoryStore } from "@connext/store";

describe("Withdraw offline tests", () => {
  let clock: any;
  let client: IConnextClient;
  let signer: IChannelSigner;
  let store: IClientStore;

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_SM,
    assetId: string = AddressZero,
  ): Promise<IConnextClient> => {
    client = await createClientWithMessagingLimits({
      signer,
      store,
      ...messagingConfig,
    });
    await fundChannel(client, amount, assetId);
    return client;
  };

  const recreateClientAndRetryWithdraw = async (
    client: IConnextClient,
    store: IClientStore,
    withdrawParams: any,
  ) => {
    const { amount, assetId, recipient } = withdrawParams;
    await client.messaging.disconnect();
    const newClient = await createClient({ signer, store });
    // Check that client can recover and continue
    await withdrawFromChannel(newClient, amount, assetId, recipient);
  };

  beforeEach(async () => {
    signer = getRandomChannelSigner(env.ethProviderUrl);
    store = getMemoryStore();
    // create the clock
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  afterEach(async () => {
    clock && clock.reset && clock.reset();
    client && (await client.store.clear());
    client && (await client.messaging.disconnect());
  });

  it("client proposes withdrawal but doesn't receive a response from node", async () => {
    const addr = addressBook[4447].WithdrawApp.address;
    await createAndFundChannel({
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.propose,
      params: { appDefinition: addr },
    });

    (client.messaging as TestMessagingService).on(RECEIVED, (msg: MessagingEventData) => {
      if (getProtocolFromData(msg) === "propose") {
        const { appDefinition } = getParamsFromData(msg) || {};
        if (appDefinition !== addr) {
          return;
        }
        clock.tick(CF_METHOD_TIMEOUT + 15000);
        return;
      }
    });

    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(`proposal took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`);

    await recreateClientAndRetryWithdraw(client, store, {
      amount: ZERO_ZERO_ZERO_FIVE_ETH,
      assetId: AddressZero,
    });
  });

  it.skip("client proposes a node submitted withdrawal but node is offline for one message (commitment should be written to store and retried)", async () => {
    await createAndFundChannel();

    await new Promise((resolve) => {
      client.once(EventNames.UPDATE_STATE_EVENT, async () => {
        // wait for the value to actually be written to the store,
        // takes longer than the `disconnect` call
        await delay(500);
        await client.messaging.disconnect();
        clock.tick(89_000);
        resolve();
      });
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero);
    });

    const [val] = await client.store.getUserWithdrawals!();
    expect(val).to.not.be.undefined;
    expect(val.tx).to.not.be.undefined;
    expect(val.retry).to.be.equal(0);
    expect(val.tx).to.be.containSubset({ to: client.multisigAddress, value: 0 });

    // restart the client
    const reconnected = await createClient({
      signer,
      store: client.store,
    });
    expect(reconnected.publicIdentifier).to.be.equal(client.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(client.multisigAddress);
    expect(reconnected.signerAddress).to.be.equal(client.signerAddress);

    const startingBalance = await ethProvider.getBalance(client.multisigAddress);
    await new Promise((resolve: Function) => {
      ethProvider.on(client.multisigAddress, (balance: BigNumber) => {
        if (!balance.eq(startingBalance)) {
          resolve();
        }
      });
    });

    // make sure the withdrawal has been handled
    const [resubmitted] = await client.store.getUserWithdrawals!();
    expect(resubmitted).to.not.be.ok;
  });
});
