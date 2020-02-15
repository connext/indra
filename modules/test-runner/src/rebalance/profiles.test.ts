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

  it.todo("throws error if collateral targets are higher than reclaim");

  it.todo("throws error if collateralize upper bound is lower than higher bound");

  it.todo("throws error if reclaim upper bound is lower than higher bound");
});
