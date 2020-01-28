import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { expect, COLLATERAL_AMOUNT_TOKEN } from "../util";
import { createClient, ETH_AMOUNT_SM, getStore } from "../util";

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
  });

  it("happy case: client can delete its store and restore from a remote backup", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    // check balances pre
    const freeBalanceEthPre = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[clientA.freeBalanceAddress]).to.be.eq(ETH_AMOUNT_SM);
    expect(freeBalanceEthPre[nodeFreeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[clientA.freeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[nodeFreeBalanceAddress]).to.be.eq(COLLATERAL_AMOUNT_TOKEN);

    // delete store
    const store = getStore(clientA.publicIdentifier);
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
    expect(freeBalanceEthPost[clientA.freeBalanceAddress]).to.be.eq(ETH_AMOUNT_SM);
    expect(freeBalanceEthPost[nodeFreeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPost[clientA.freeBalanceAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPost[nodeFreeBalanceAddress]).to.be.eq(COLLATERAL_AMOUNT_TOKEN);
  });
});
