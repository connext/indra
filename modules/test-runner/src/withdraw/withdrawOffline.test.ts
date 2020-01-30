import { IConnextClient } from "@connext/types";
import { BigNumber } from "ethers/utils";
import { AddressZero } from "ethers/constants";
import * as lolex from "lolex";
import {
  ETH_AMOUNT_MD,
  ClientTestMessagingInputOpts,
  createClientWithMessagingLimits,
  fundChannel,
  cleanupMessaging,
} from "../util";

describe("Withdraw offline tests", () => {
  let clock: any;
  let client: IConnextClient;

  /////////////////////////////////
  /// TEST SPECIFIC HELPERS

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_MD,
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
    client = createAndFundChannel({
      ceiling: { received: },
      protocol: "withdraw"
    });

  });

  it("client proposes withdrawal and then goes offline before node responds", async () => {});

  it("client proposes a node submitted withdrawal but node is offline for one message (commitment should be written to store and retried)", async () => {});

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
