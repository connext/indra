import { IConnextClient } from "@connext/types";
import { constants } from "ethers";

import { createClient, ETH_AMOUNT_MD, expect, TOKEN_AMOUNT } from "../util";

const { AddressZero, Zero } = constants;

describe("Collateral", () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses[client.chainId].Token!;
    nodeSignerAddress = client.nodeSignerAddress;
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: node should collateralize ETH", async () => {
    const response = (await client.requestCollateral(AddressZero))!;
    expect(response).to.be.ok;
    const tx = response.transaction;
    expect(tx.hash).to.be.ok;
    await response.completed();
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.signerAddress]).to.be.eq("0");
    expect(freeBalance[nodeSignerAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    const response = (await client.requestCollateral(tokenAddress))!;
    expect(response).to.be.ok;
    const tx = response.transaction;
    expect(tx.hash).to.be.ok;
    await response.completed();
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.signerAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);
  });
});
