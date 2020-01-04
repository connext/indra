import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient } from "../util/client";
import { FUNDED_MNEMONICS } from "../util/constants";
import { clearDb } from "../util/db";
import { revertEVMSnapshot, takeEVMSnapshot } from "../util/ethprovider";
import { parseEther } from "ethers/utils";

describe("Collateral", () => {
  let clientA: IConnextClient;
  let snapshot: string;

  beforeEach(async () => {
    await clearDb();
    clientA = await createClient(FUNDED_MNEMONICS[0]);
    snapshot = await takeEVMSnapshot();
  }, 90_000);

  afterEach(async () => {
    await revertEVMSnapshot(snapshot);
  });

  test.only("happy case: node should collateralize ETH", async () => {
    await clientA.requestCollateral(AddressZero);
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(0);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(parseEther("0.1"));
  });

  test("happy case: node should collateralize tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.requestCollateral(tokenAddress);
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).toBeBigNumberEq(0);
    expect(freeBalance[nodeFreeBalanceAddress]).toBeBigNumberEq(1);
  });
});
