import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { createClient, expect, ETH_AMOUNT_MD, TOKEN_AMOUNT } from "../util";

describe("Collateral", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
    nodeFreeBalanceAddress = xkeyKthAddress(client.config.nodePublicIdentifier);
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: node should collateralize ETH", async () => {
    await client.requestCollateral(AddressZero);
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.freeBalanceAddress]).to.be.eq("0");
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    await client.requestCollateral(tokenAddress);
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.freeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.least(TOKEN_AMOUNT);
  });
});
