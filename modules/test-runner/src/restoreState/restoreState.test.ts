import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { expect } from "../util";
import { createClient, ETH_AMOUNT_SM, getStore, TOKEN_AMOUNT } from "../util";

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

  it("happy case: client can delete its store and restore from a remote backup", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    // check balances pre
    const freeBalanceEthPre = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[clientA.freeBalanceAddress].toString()).to.be.eq(ETH_AMOUNT_SM.toString());
    expect(freeBalanceEthPre[nodeFreeBalanceAddress].toString()).to.be.eq(Zero.toString());
    expect(freeBalanceTokenPre[clientA.freeBalanceAddress].toString()).to.be.eq(Zero.toString());
    expect(freeBalanceTokenPre[nodeFreeBalanceAddress].toString()).to.be.eq(TOKEN_AMOUNT.toString());

    // delete store
    const store = getStore();
    store.reset();

    // check that getting balances will now error
    await expect(clientA.getFreeBalance(AddressZero)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
    await expect(clientA.getFreeBalance(tokenAddress)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );

    await clientA.restoreState();

    // check balances post
    const freeBalanceEthPost = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPost = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPost[clientA.freeBalanceAddress].toString()).to.be.eq(ETH_AMOUNT_SM.toString());
    expect(freeBalanceEthPost[nodeFreeBalanceAddress].toString()).to.be.eq(Zero.toString());
    expect(freeBalanceTokenPost[clientA.freeBalanceAddress].toString()).to.be.eq(Zero.toString());
    expect(freeBalanceTokenPost[nodeFreeBalanceAddress].toString().toString()).to.be.eq(TOKEN_AMOUNT.toString().toString());
  });
});
