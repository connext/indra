import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { createClient, expect, ETH_AMOUNT_MD, TOKEN_AMOUNT, getOnchainTransactionsForChannel } from "../util";

describe("Collateral", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  it("happy case: node should collateralize ETH", async () => {
    await clientA.requestCollateral(AddressZero);
    const freeBalance = await clientA.getFreeBalance(AddressZero);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).to.be.eq("0");
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.eq(ETH_AMOUNT_MD);

    const onchainTransactions = await getOnchainTransactionsForChannel(clientA.publicIdentifier);
    expect(onchainTransactions.length).to.equal(1, "Should only be 1 onchain transaction for this channel");
    const [depositTx] = onchainTransactions;
    expect(depositTx.reason).to.equal("COLLATERALIZATION");
  });

  it("happy case: node should collateralize tokens", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;

    await clientA.requestCollateral(tokenAddress);
    const freeBalance = await clientA.getFreeBalance(tokenAddress);

    const nodeFreeBalanceAddress = xkeyKthAddress(clientA.config.nodePublicIdentifier);
    expect(freeBalance[clientA.freeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeFreeBalanceAddress]).to.be.least(TOKEN_AMOUNT);

    const onchainTransactions = await getOnchainTransactionsForChannel(clientA.publicIdentifier);
    expect(onchainTransactions.length).to.equal(1, "Should only be 1 onchain transaction for this channel");
    const [depositTx] = onchainTransactions;
    expect(depositTx.reason).to.equal("COLLATERALIZATION");
  });
});
