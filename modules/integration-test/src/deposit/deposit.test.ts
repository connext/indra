import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient } from "../util/client";
import { FUNDED_MNEMONICS } from "../util/constants";
import { clearDb } from "../util/db";
import { getOnchainBalance, revertEVMSnapshot, takeEVMSnapshot } from "../util/ethprovider";

describe("Deposits", () => {
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

  test.skip("happy case: client should deposit ETH", async () => {
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

  test.only("client should not be able to propose deposit with value it doesn't have", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await expect(
      clientA.deposit({
        amount: (await getOnchainBalance(clientA.freeBalanceAddress, tokenAddress)) + 1,
        assetId: clientA.config.contractAddresses.Token,
      }),
    ).rejects.toThrowError("is not less than or equal to");
  });

  test("client has already requested deposit rights before calling deposit", async () => { });

  test("client tries to deposit while node already has deposit rights but has not sent a tx to chain", async () => { });

  test("client tries to deposit while node already has deposit rights and has sent tx to chain (not confirmed onchain)", async () => { });

  test("client deposits a different amount onchain than passed into the deposit fn", async () => { });

  test("client proposes deposit but no response from node (node doesn't receive NATS message)", async () => { });

  test("client proposes deposit but no response from node (node receives NATS message after timeout expired)", async () => { });

  test("client goes offline after proposing deposit and then comes back online after timeout is over", async () => { });

  test("client proposes deposit then deletes its store", async () => { });

  test("client proposes deposit but never sends tx to chain", async () => { });

  test("client proposes deposit, sends tx to chain, but deposit takes a long time to confirm", async () => { });

  test("client proposes deposit, sends tx to chain, but deposit fails onchain", async () => { });

  test("client bypasses proposeDeposit flow and calls providerDeposit directly", async () => { });

  test("client deposits, withdraws, then successfully deposits again", async () => { });
});
