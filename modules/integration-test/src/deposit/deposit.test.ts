import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient } from "../util/client";
import { FUNDED_MNEMONICS } from "../util/constants";
import { clearDb } from "../util/db";

describe("Deposits", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    // TODO: try to snapshot db instead
    await clearDb();
    clientA = await createClient(FUNDED_MNEMONICS[0]);
  }, 90_000);

  test("client A should deposit ETH", async () => {
    await clientA.deposit({ amount: "1", assetId: AddressZero });
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(1);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(0);

    // TODO: assert node's version of free balance also?
  });

  test("client A should deposit tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.deposit({ amount: "1", assetId: tokenAddress });
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(1);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(0);

    // TODO: assert node's version of free balance also?
  });
});
