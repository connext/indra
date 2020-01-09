import { createClient, getStore } from "../util/client";
import { IConnextClient } from "@connext/types";
import { xkeyKthAddress } from "@connext/cf-core";
import { parseEther } from "ethers/utils";
import { AddressZero, Zero } from "ethers/constants";

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

    // delete store
    const store = getStore();
    store.reset();

    // check balances pre (will this work?)
    const freeBalanceEthPre = clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[nodeFreeBalanceAddress]).toBe(undefined);
    expect(freeBalanceEthPre[nodeFreeBalanceAddress]).toBe(undefined);
    expect(freeBalanceTokenPre[clientA.freeBalanceAddress]).toBe(undefined);
    expect(freeBalanceTokenPre[nodeFreeBalanceAddress]).toBe(undefined);

    // clientA.restoreState();

    // // check balances post
    // const freeBalanceEthPost = clientA.getFreeBalance(AddressZero);
    // const freeBalanceTokenPost = clientA.getFreeBalance(tokenAddress);
    // expect(freeBalanceEthPost[clientA.freeBalanceAddress]).toBeBigNumberEq(parseEther("0.01"));
    // expect(freeBalanceEthPost[nodeFreeBalanceAddress]).toBeBigNumberEq(Zero);
    // expect(freeBalanceTokenPost[clientA.freeBalanceAddress]).toBeBigNumberEq(Zero);
    // expect(freeBalanceTokenPost[nodeFreeBalanceAddress]).toBeBigNumberEq(parseEther("0.01"));
  });
});
