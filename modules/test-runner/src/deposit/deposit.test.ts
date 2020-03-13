import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { expect, NEGATIVE_ONE, ONE, TWO, WRONG_ADDRESS } from "../util";
import { createClient } from "../util/client";
import { getOnchainBalance } from "../util/ethprovider";

describe("Deposits", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
    console.log('client.config: ', client.config);
    nodeFreeBalanceAddress = xkeyKthAddress(client.config.nodePublicIdentifier);
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it.only("happy case: client should deposit ETH", async () => {
    await client.deposit({ amount: ONE, assetId: AddressZero });
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.freeBalanceAddress]).to.equal(ONE);
    expect(freeBalance[nodeFreeBalanceAddress]).to.equal("0");
    // TODO: assert node's version of free balance also?
  });

  it("happy case: client should deposit tokens", async () => {
    await client.deposit({ amount: ONE, assetId: tokenAddress });
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.freeBalanceAddress]).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq("0");
    // TODO: assert node's version of free balance also?
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
    await client.requestDepositRights({ assetId: client.config.contractAddresses.Token });
    await client.deposit({
      amount: ONE,
      assetId: client.config.contractAddresses.Token,
    });
    const freeBalance = await client.getFreeBalance(client.config.contractAddresses.Token);
    expect(freeBalance[client.freeBalanceAddress]).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq("0");
    // TODO: is there any way to test to make sure deposit rights were rescinded
    // as part of the .deposit call?
  });

  it.skip("client tries to deposit while node already has deposit rights but has not sent a tx to chain", async () => {});

  it.skip("client tries to deposit while node already has deposit rights and has sent tx to chain (not confirmed onchain)", async () => {});

  it.skip("client deposits a different amount onchain than passed into the deposit fn", async () => {});

  it.skip("client proposes deposit but never sends tx to chain", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit takes a long time to confirm", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit fails onchain", async () => {});

  it.skip("client bypasses proposeDeposit flow and calls providerDeposit directly", async () => {});

  it.skip("client deposits eth, withdraws, then successfully deposits eth again", async () => {
    await client.deposit({ amount: TWO, assetId: AddressZero });
    await client.withdraw({ amount: TWO, assetId: AddressZero });
    await client.deposit({ amount: ONE, assetId: AddressZero });
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.freeBalanceAddress]).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq("0");
  });

  it("client deposits eth, withdraws, then successfully deposits tokens", async () => {
    await client.deposit({ amount: TWO, assetId: AddressZero });
    await client.withdraw({ amount: TWO, assetId: AddressZero });
    await client.deposit({ amount: ONE, assetId: tokenAddress });
    const freeBalanceToken = await client.getFreeBalance(tokenAddress);
    const freeBalanceEth = await client.getFreeBalance(AddressZero);
    expect(freeBalanceEth[client.freeBalanceAddress]).to.be.eq("0");
    expect(freeBalanceEth[nodeFreeBalanceAddress]).to.be.eq("0");
    expect(freeBalanceToken[client.freeBalanceAddress]).to.be.eq(ONE);
    expect(freeBalanceToken[nodeFreeBalanceAddress]).to.be.eq("0");
  });
});
