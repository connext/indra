import { EventNames, IConnextClient, IChannelSigner, CF_METHOD_TIMEOUT } from "@connext/types";
import { ChannelSigner, delay, getRandomChannelSigner } from "@connext/utils";
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
} from "../util";

describe("Withdraw offline tests", () => {
  let clock: any;
  let client: IConnextClient;
  let signer: IChannelSigner;

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_SM,
    assetId: string = AddressZero,
  ): Promise<IConnextClient> => {
    // make sure the signer is set
    messagingConfig.signer = messagingConfig.signer || getRandomChannelSigner(env.ethProviderUrl);
    signer = typeof messagingConfig.signer === "string" 
      ? new ChannelSigner(messagingConfig.signer, env.ethProviderUrl) 
      : messagingConfig.signer;
    client = await createClientWithMessagingLimits({
      signer,
      ...messagingConfig,
    });
    await fundChannel(client, amount, assetId);
    return client;
  };

  beforeEach(async () => {
    // create the clock
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  afterEach(async () => {
    clock && clock.reset && clock.reset();
    await client.messaging.disconnect();
  });

  it("client proposes withdrawal but doesn't receive a response from node", async () => {
    await createAndFundChannel({
      ceiling: { received: 1 },
      protocol: "propose",
    });

    (client.messaging as TestMessagingService).on(RECEIVED, (msg: MessagingEventData) => {
      if (getProtocolFromData(msg) === "propose") {
        clock.tick(89_000);
        return;
      }
    });

    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(`proposal took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`);
  });

  it("client proposes withdrawal and then goes offline before node responds", async () => {
    await createAndFundChannel({
      ceiling: { sent: 1 },
      protocol: "propose",
    });

    let eventCount = 0;
    (client.messaging as TestMessagingService).on(SEND, async (msg: MessagingEventData) => {
      eventCount += 1;
      if (getProtocolFromData(msg) === "propose" && eventCount === 1) {
        // wait for message to be sent (happens after event thrown)
        await delay(500);
        clock.tick(89_000);
      }
    });

    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
    ).to.be.rejectedWith(`proposal took longer than ${CF_METHOD_TIMEOUT/1000} seconds`);
  });

  it.skip("client proposes a node submitted withdrawal but node is offline for one message (commitment should be written to store and retried)", async () => {
    await createAndFundChannel();

    await new Promise(resolve => {
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
