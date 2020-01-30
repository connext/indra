import { IConnextClient } from "@connext/types";
import { BigNumber } from "ethers/utils";
import { AddressZero, Zero } from "ethers/constants";
import * as lolex from "lolex";
import {
  ClientTestMessagingInputOpts,
  cleanupMessaging,
  createClientWithMessagingLimits,
  ETH_AMOUNT_SM,
  expect,
  fastForwardDuringCall,
  fundChannel,
  withdrawFromChannel,
  ZERO_ZERO_ZERO_FIVE_ETH,
  FORBIDDEN_SUBJECT,
  getStore,
  getOpts,
  createClient,
  ethProvider,
} from "../util";
import { utils } from "@connext/client";

const { withdrawalKey } = utils;

describe("Withdraw offline tests", () => {
  let clock: any;
  let client: IConnextClient;

  /////////////////////////////////
  /// TEST SPECIFIC HELPERS

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_SM,
    assetId: string = AddressZero,
  ): Promise<IConnextClient> => {
    // make sure the tokenAddress is set
    const client = await createClientWithMessagingLimits(messagingConfig);
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

  it("client proposes withdrawal but doesn't receive a response from node", async () => {
    client = await createAndFundChannel({
      ceiling: { received: 0 },
      protocol: "withdraw",
    });

    await fastForwardDuringCall(
      89_000,
      () => withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
      clock,
      `timed out after 90s waiting for counterparty reply in withdraw`,
    );
  });

  it("client proposes withdrawal and then goes offline before node responds", async () => {
    client = await createAndFundChannel({
      ceiling: { sent: 1 },
      protocol: "withdraw",
    });

    await fastForwardDuringCall(
      89_000,
      () => withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
      clock,
      `timed out after 90s waiting for counterparty reply in withdraw`,
    );
  });

  it("client proposes a node submitted withdrawal but node is offline for one message (commitment should be written to store and retried)", async () => {
    client = await createAndFundChannel({
      forbiddenSubjects: ["channel.withdraw"],
    });

    // make call, should fail
    await fastForwardDuringCall(
      89_000,
      () => withdrawFromChannel(client, ZERO_ZERO_ZERO_FIVE_ETH, AddressZero),
      clock,
      FORBIDDEN_SUBJECT,
    );

    // make sure withdrawal is in the store
    const store = getStore(client.publicIdentifier);
    const { tx, retry } = await store.get(withdrawalKey(client.publicIdentifier));
    expect(tx).to.be.ok;
    expect(tx.to).to.be.equal(client.multisigAddress);
    expect(tx.value).equal(Zero); // amt transferred in internal tx
    expect(retry).to.be.equal(0);

    // restart the client
    const { mnemonic } = getOpts(client.publicIdentifier);
    const reconnected = await createClient({ mnemonic, store });
    expect(reconnected.publicIdentifier).to.be.equal(client.publicIdentifier);
    expect(reconnected.multisigAddress).to.be.equal(client.multisigAddress);
    expect(reconnected.freeBalanceAddress).to.be.equal(client.freeBalanceAddress);

    await new Promise((resolve: Function) => {
      ethProvider.once(client.multisigAddress, async () => {
        resolve();
      });
    });

    // make sure the withdrawal has been handled
    const resubmitted = await store.get(withdrawalKey(client.publicIdentifier));
    expect(resubmitted).to.not.be.ok;
  });

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
