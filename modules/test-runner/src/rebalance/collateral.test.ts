import { IConnextClient, EventNames } from "@connext/types";
import { constants, BigNumber } from "ethers";

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
    expect(response.completed).to.be.ok;
    expect(response.transaction).to.be.ok;
    expect(response.transaction.hash).to.be.ok;
    expect(response.depositAppIdentityHash).to.be.ok;
    const { freeBalance } = await response.completed();
    expect(freeBalance[client.signerAddress]).to.be.eq("0");
    expect(freeBalance[nodeSignerAddress]).to.be.eq(ETH_AMOUNT_MD);
  });

  it("happy case: node should collateralize tokens", async () => {
    const response = (await client.requestCollateral(tokenAddress))!;
    expect(response).to.be.ok;
    expect(response.completed).to.be.ok;
    expect(response.transaction).to.be.ok;
    expect(response.transaction.hash).to.be.ok;
    expect(response.depositAppIdentityHash).to.be.ok;
    const { freeBalance } = await response.completed();
    expect(freeBalance[client.signerAddress]).to.be.eq(Zero);
    expect(freeBalance[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);
  });

  it("should properly handle concurrent collateral requests", async () => {
    const appDef = client.config.contractAddresses[client.chainId].DepositApp;
    let depositAppCount = 0;
    client.on(EventNames.INSTALL_EVENT, (msg) => {
      const { appDefinition } = msg.appInstance;
      if (appDefinition === appDef) {
        depositAppCount += 1;
      }
    });
    const res = await Promise.all([
      client.requestCollateral(tokenAddress),
      client.requestCollateral(tokenAddress),
    ]);
    await Promise.all(res.map((r) => r?.completed()));
    expect(depositAppCount).to.be.eq(1);
  });
});
