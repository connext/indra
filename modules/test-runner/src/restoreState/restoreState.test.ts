import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, parseEther } from "ethers/utils";

import { createClient, getStore } from "../util/client";

describe("Restore State", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();

    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
  }, 90_000);

  test("happy case: client can delete its store and restore from a remote backup", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: parseEther("0.01").toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    // check balances pre
    const freeBalanceEthPre = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[clientA.freeBalanceAddress]).toBeBigNumberEq(parseEther("0.01"));
    expect(freeBalanceEthPre[nodeFreeBalanceAddress]).toBeBigNumberEq(Zero);
    expect(freeBalanceTokenPre[clientA.freeBalanceAddress]).toBeBigNumberEq(Zero);
    expect(freeBalanceTokenPre[nodeFreeBalanceAddress]).toBeBigNumberEq(parseEther("10"));

    // delete store
    const store = getStore();
    store.reset();

    // check that getting balances will now error
    await expect(clientA.getFreeBalance(AddressZero)).rejects.toThrowError(
      "Call to getStateChannel failed when searching for multisig address",
    );
    await expect(clientA.getFreeBalance(tokenAddress)).rejects.toThrowError(
      "Call to getStateChannel failed when searching for multisig address",
    );

    await clientA.restoreState();

    // check balances post
    const freeBalanceEthPost = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPost = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPost[clientA.freeBalanceAddress]).toBeBigNumberEq(parseEther("0.01"));
    expect(freeBalanceEthPost[nodeFreeBalanceAddress]).toBeBigNumberEq(Zero);
    expect(freeBalanceTokenPost[clientA.freeBalanceAddress]).toBeBigNumberEq(Zero);
    expect(freeBalanceTokenPost[nodeFreeBalanceAddress]).toBeBigNumberEq(parseEther("10"));
  });
});
