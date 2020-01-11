import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { createClient, TEST_ETH_AMOUNT_ALT, TEST_TOKEN_AMOUNT } from "../util";

describe("Collateral", () => {
  let clientA: IConnextClient;
  let ethAmountAlt: BigNumber;
  let tokenAmount: BigNumber;

  beforeEach(async () => {
    clientA = await createClient();
    ethAmountAlt = TEST_ETH_AMOUNT_ALT;
    tokenAmount = TEST_TOKEN_AMOUNT;
  }, 90_000);

  test("happy case: node should collateralize ETH", async () => {
    await clientA.requestCollateral(AddressZero);
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(0);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(ethAmountAlt);
  });

  test("happy case: node should collateralize tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.requestCollateral(tokenAddress);
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(0);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(tokenAmount);
  });
});
