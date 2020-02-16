import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { before, after } from "mocha";

import { createClient } from "../util";
import { connectNats } from "../util/nats";
import { Client } from "ts-nats";
import { AddressZero } from "ethers/constants";

describe("Reclaim", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nats: Client;

  before(async () => {
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

  it.skip("throws error if collateral targets are higher than reclaim");

  it.skip("throws error if collateralize upper bound is lower than higher bound");

  it.skip("throws error if reclaim upper bound is lower than higher bound");
});
