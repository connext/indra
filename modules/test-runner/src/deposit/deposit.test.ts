import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { expect, NEGATIVE_ONE, ONE, TWO, WRONG_ADDRESS } from "../util";
import { createClient } from "../util/client";
import { getOnchainBalance } from "../util/ethprovider";

describe("Deposits", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  }, 90_000);

  it("happy case: client should deposit ETH", async () => {
    await clientA.deposit({ amount: ONE, assetId: AddressZero });
    const freeBalance = await clientA.getFreeBalance(AddressZero);
    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress].toString()).to.equal(ONE);
    expect(freeBalance[nodeFreeBalanceAddress].toString()).to.equal("0");
    // TODO: assert node's version of free balance also?
  });

  it("happy case: client should deposit tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.deposit({ amount: ONE, assetId: tokenAddress });
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress].toString()).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress].toString()).to.be.eq("0");

    // TODO: assert node's version of free balance also?
  });

  it("client should not be able to deposit with invalid token address", async () => {
    await expect(clientA.deposit({ amount: ONE, assetId: WRONG_ADDRESS })).to.be.rejected;
    // TODO: assert error message
  });

  it("client should not be able to deposit with negative amount", async () => {
    await expect(
      clientA.deposit({ amount: NEGATIVE_ONE, assetId: AddressZero }),
    ).to.be.rejectedWith("is not greater than or equal to 0");
  });

  it("client should not be able to propose deposit with value it doesn't have", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;
    await expect(
      clientA.deposit({
        amount: (await getOnchainBalance(clientA.freeBalanceAddress, tokenAddress))
          .add(1)
          .toString(),
        assetId: clientA.config.contractAddresses.Token,
      }),
    ).to.be.rejectedWith("is not less than or equal to");
  });

  it("client has already requested deposit rights before calling deposit", async () => {
    await clientA.requestDepositRights({ assetId: clientA.config.contractAddresses.Token });

    await clientA.deposit({
      amount: ONE,
      assetId: clientA.config.contractAddresses.Token,
    });
    const freeBalance = await clientA.getFreeBalance(clientA.config.contractAddresses.Token);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress].toString()).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress].toString()).to.be.eq("0");
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
    await clientA.deposit({ amount: TWO, assetId: AddressZero });
    await clientA.withdraw({ amount: TWO, assetId: AddressZero });
    await clientA.deposit({ amount: ONE, assetId: AddressZero });

    const freeBalance = await clientA.getFreeBalance(AddressZero);
    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress].toString()).to.be.eq(ONE);
    expect(freeBalance[nodeFreeBalanceAddress].toString()).to.be.eq("0");
  });

  it("client deposits eth, withdraws, then successfully deposits tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.deposit({ amount: TWO, assetId: AddressZero });
    await clientA.withdraw({ amount: TWO, assetId: AddressZero });
    await clientA.deposit({ amount: ONE, assetId: tokenAddress });

    const freeBalanceToken = await clientA.getFreeBalance(tokenAddress);
    const freeBalanceEth = await clientA.getFreeBalance(AddressZero);
    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalanceEth[clientA.freeBalanceAddress].toString()).to.be.eq("0");
    expect(freeBalanceEth[nodeFreeBalanceAddress].toString()).to.be.eq("0");
    expect(freeBalanceToken[clientA.freeBalanceAddress].toString()).to.be.eq(ONE);
    expect(freeBalanceToken[nodeFreeBalanceAddress].toString()).to.be.eq("0");
  });
});
