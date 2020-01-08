import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient, fundChannel, withdrawFromChannel } from "../util";

describe("Withdrawal", () => {
  let client: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
  }, 90_000);

  test("happy case: client successfully withdraws eth and submits the tx itself", async () => {
    // fund client with eth
    await fundChannel(client, "0.02");
    // withdraw
    await withdrawFromChannel(client, "0.01", AddressZero, true);
  });

  test("happy case: client successfully withdraws tokens and submits the tx itself", async () => {
    // fund client with tokens
    await fundChannel(client, "0.02", tokenAddress);
    // withdraw
    await withdrawFromChannel(client, "0.01", tokenAddress, true);
  });

  test("happy case: client successfully withdraws eth and node submits the tx", async () => {
    await fundChannel(client, "0.02");
    // withdraw
    await withdrawFromChannel(client, "0.01", AddressZero);
  });

  test("happy case: client successfully withdraws tokens and node submits the tx", async () => {
    await fundChannel(client, "0.02", tokenAddress);
    // withdraw
    await withdrawFromChannel(client, "0.01", tokenAddress);
  });
});
