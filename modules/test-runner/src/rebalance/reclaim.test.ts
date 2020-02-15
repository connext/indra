import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";

import { createClient } from "../util";
import { connectNats } from "../util/nats";
import { Client } from "ts-nats";
import { AddressZero } from "ethers/constants";

describe("Reclaim", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nats: Client;

  beforeAll(async () => {
    nats = await connectNats();
  });

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
    nodeFreeBalanceAddress = xkeyKthAddress(client.config.nodePublicIdentifier);
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  afterAll(() => {
    nats.close();
  });

  it("happy case: node should reclaim ETH after linked transfer", async () => {
    // set rebalancing profile to reclaim collateral
    await nats.request(`channel.add-profile.${client.publicIdentifier}`, 5000, {
      assetId: AddressZero,
      lowerBoundCollateralize: "5",
      upperBoundCollateralize: "10",
      // eslint-disable-next-line sort-keys
      lowerBoundReclaim: "20",
      upperBoundReclaim: "30",
      // eslint-disable-next-line sort-keys
      token: "foo",
    });

    // verify profile

    // deposit client

    // transfer to node to get node over upper bound reclaim

    // verify that node reclaims until lower bound reclaim
  });

  it.todo("happy case: node should reclaim tokens after linked transfer", async () => {});

  it.todo("happy case: node should reclaim ETH after async transfer", async () => {})

  it.todo("happy case: node should reclaim tokens after async transfer", async () => {});
});
