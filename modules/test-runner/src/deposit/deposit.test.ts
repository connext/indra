import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, BigNumberish } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { expect, NEGATIVE_ONE, ONE, TWO, WRONG_ADDRESS } from "../util";
import { createClient } from "../util/client";
import { getOnchainBalance } from "../util/ethprovider";

describe("Deposits", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;

  const assertFreeBalanceVersion = async (
    client: IConnextClient,
    expected: { node: BigNumberish; client: BigNumberish; assetId?: string },
  ): Promise<void> => {
    const freeBalance = await client.getFreeBalance(expected.assetId || AddressZero);
    expect(freeBalance[client.freeBalanceAddress]).to.equal(expected.client);
    expect(freeBalance[nodeFreeBalanceAddress]).to.equal(expected.node);
  };

  const assertNodeFreeBalance = async (
    client: IConnextClient,
    expected: { node: BigNumberish; client: BigNumberish; assetId?: string },
  ): Promise<void> => {
    await client.restoreState();
    await assertFreeBalanceVersion(client, expected);
  };

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
    nodeFreeBalanceAddress = xkeyKthAddress(client.config.nodePublicIdentifier);
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: client should deposit ETH", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: AddressZero,
    };
    await client.deposit({ amount: expected.client, assetId: expected.assetId });
    await assertFreeBalanceVersion(client, expected);
    await assertNodeFreeBalance(client, expected);
  });

  it("happy case: client should deposit tokens", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: tokenAddress,
    };
    await client.deposit({ amount: expected.client, assetId: expected.assetId });
    await assertFreeBalanceVersion(client, expected);
    await assertNodeFreeBalance(client, expected);
  });

  it("client should not be able to deposit with invalid token address", async () => {
    await expect(client.deposit({ amount: ONE, assetId: WRONG_ADDRESS })).to.be.rejected;
    // TODO: assert error message
  });

  it("client should not be able to deposit with negative amount", async () => {
    await expect(client.deposit({ amount: NEGATIVE_ONE, assetId: AddressZero })).to.be.rejectedWith(
      "is not greater than or equal to 0",
    );
  });

  it("client should not be able to propose deposit with value it doesn't have", async () => {
    await expect(
      client.deposit({
        amount: (await getOnchainBalance(client.freeBalanceAddress, tokenAddress))
          .add(1)
          .toString(),
        assetId: client.config.contractAddresses.Token,
      }),
    ).to.be.rejectedWith("is not less than or equal to");
  });

  it("client has already requested deposit rights before calling deposit", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: tokenAddress,
    };
    await client.requestDepositRights({ assetId: expected.assetId });
    await client.deposit({ amount: expected.client, assetId: expected.assetId });
    await assertFreeBalanceVersion(client, expected);
    await assertNodeFreeBalance(client, expected);
    await expect(
      client.checkDepositRights({ assetId: client.config.contractAddresses.Token }),
    ).to.be.rejectedWith(`No balance refund app installed`);
  });

  it.skip("client tries to deposit while node already has deposit rights but has not sent a tx to chain", async () => {});

  it.skip("client tries to deposit while node already has deposit rights and has sent tx to chain (not confirmed onchain)", async () => {});

  it.skip("client deposits a different amount onchain than passed into the deposit fn", async () => {});

  it.skip("client proposes deposit but never sends tx to chain", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit takes a long time to confirm", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit fails onchain", async () => {});

  it.skip("client bypasses proposeDeposit flow and calls providerDeposit directly", async () => {});

  it("client deposits eth, withdraws, then successfully deposits eth again", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: AddressZero,
    };
    await client.deposit({ amount: TWO, assetId: expected.assetId });
    await client.withdraw({ amount: TWO, assetId: expected.assetId });
    await client.deposit({ amount: expected.client, assetId: expected.assetId });
    await assertFreeBalanceVersion(client, expected);
    await assertNodeFreeBalance(client, expected);
  });

  it("client deposits eth, withdraws, then successfully deposits tokens", async () => {
    const ethExpected = {
      client: Zero,
      assetId: AddressZero,
      node: Zero,
    };
    const tokenExpected = {
      client: ONE,
      assetId: tokenAddress,
      node: Zero,
    };
    await client.deposit({ amount: TWO, assetId: ethExpected.assetId });
    await client.withdraw({ amount: TWO, assetId: ethExpected.assetId });
    await client.deposit({ amount: tokenExpected.client, assetId: tokenExpected.assetId });
    await assertFreeBalanceVersion(client, ethExpected);
    await assertFreeBalanceVersion(client, tokenExpected);
    await assertNodeFreeBalance(client, ethExpected);
    await assertNodeFreeBalance(client, tokenExpected);
  });
});
