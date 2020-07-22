import { IConnextClient } from "@connext/types";
import { constants } from "ethers";

import {
  createClient,
  expect,
  ETH_AMOUNT_MD,
  TOKEN_AMOUNT,
} from "../util";

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
    await client.requestCollateral(AddressZero);
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.signerAddress]).to.be.eq("0");
    expect(freeBalance[nodeSignerAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    await client.requestCollateral(tokenAddress);
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.signerAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);
  });
});
