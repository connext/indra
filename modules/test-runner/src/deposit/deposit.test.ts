import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient } from "../util/client";

describe("Deposits", () => {
  let clientA: IConnextClient;
  
  beforeEach(async () => {
    clientA = await createClient();
  }, 90_000);

  test("happy case: client should deposit ETH", async () => {
    await clientA.deposit({ amount: "1", assetId: AddressZero });
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(1);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(0);

    // TODO: assert node's version of free balance also?
  });

  test("happy case: client should deposit tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.deposit({ amount: "1", assetId: tokenAddress });
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(1);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(0);

    // TODO: assert node's version of free balance also?
  });

  // TODO: unskip when it passes
  test.skip("client should not be able to deposit with invalid token address", async () => {
    // TODO: fix assert message when this is fixed
    await expect(clientA.deposit({ amount: "1", assetId: "0xdeadbeef" })).rejects.toThrowError(
      "invalid token address",
    );
  });

  test("client should not be able to deposit with negative amount", async () => {
    await expect(clientA.deposit({ amount: "-1", assetId: AddressZero })).rejects.toThrowError(
      "is not greater than or equal to 0",
    );
  });
});
