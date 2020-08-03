import { IConnextClient, EventNames } from "@connext/types";
import { constants } from "ethers";

import {
  createClient,
  ETH_AMOUNT_MD,
  ethProvider,
  expect,
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

  // TODO: rm 'as any' once type returned by requestCollateral is fixed

  it("happy case: node should collateralize ETH", async () => {
    const tx = await client.requestCollateral(AddressZero) as any;
    expect(tx).to.be.ok;
    await ethProvider.waitForTransaction(tx.hash);
    await client.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
    const freeBalance = await client.getFreeBalance(AddressZero);
    expect(freeBalance[client.signerAddress]).to.be.eq("0");
    expect(freeBalance[nodeSignerAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    const tx = await client.requestCollateral(tokenAddress) as any;
    expect(tx).to.be.ok;
    await ethProvider.waitForTransaction(tx.hash);
    await client.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
    const freeBalance = await client.getFreeBalance(tokenAddress);
    expect(freeBalance[client.signerAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);
  });
});
