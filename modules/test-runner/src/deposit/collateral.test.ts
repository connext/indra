import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { createClient, expect, ETH_AMOUNT_MD, COLLATERAL_AMOUNT_TOKEN } from "../util";

describe("Collateral", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  it("happy case: node should collateralize ETH", async () => {
    await clientA.requestCollateral(AddressZero);
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).to.be.eq("0");
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.requestCollateral(tokenAddress);
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq(COLLATERAL_AMOUNT_TOKEN);
  });
});
