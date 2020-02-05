import { AddressZero } from "ethers/constants";

import { createClient, ethProvider, expect, getOnchainBalance, sendOnchainValue } from "../util";
import { IConnextClient } from "@connext/types";

describe("Deposits", () => {
  let client: IConnextClient;

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("happy case: client should request deposit rights and deposit ETH", async () => {
    client = await createClient();
    await client.requestDepositRights({ assetId: AddressZero });
    const { [client.freeBalanceAddress]: preDeposit } = await client.getFreeBalance(AddressZero);
    expect(preDeposit).to.be.eq("0");
    const balance = await getOnchainBalance(client.multisigAddress);
    expect(balance).to.be.eq("0");
    await new Promise(
      async (res: any): Promise<any> => {
        ethProvider.on(client.multisigAddress, async () => {
          const balance = await getOnchainBalance(client.multisigAddress);
          expect(balance).to.be.eq("1");
          await client.rescindDepositRights({ assetId: AddressZero });
          const { [client.freeBalanceAddress]: postDeposit } = await client.getFreeBalance(
            AddressZero,
          );
          expect(postDeposit).to.be.eq("1");
          res();
        });
        await sendOnchainValue(client.multisigAddress, 1);
      },
    );
  });

  it("happy case: client should request deposit rights and deposit token", async () => {
    client = await createClient();
    const tokenAddress = client.config.contractAddresses.Token;
    await client.requestDepositRights({ assetId: tokenAddress });
    const { [client.freeBalanceAddress]: preDeposit } = await client.getFreeBalance(tokenAddress);
    expect(preDeposit).to.be.eq("0");
    const balance = await getOnchainBalance(client.multisigAddress, tokenAddress);
    expect(balance).to.be.eq("0");
    await new Promise(
      async (res: any, rej: any): Promise<any> => {
        ethProvider.on(client.multisigAddress, async () => {
          const balance = await getOnchainBalance(client.multisigAddress, tokenAddress);
          expect(balance).to.be.eq("1");
          await client.rescindDepositRights({ assetId: tokenAddress });
          const { [client.freeBalanceAddress]: postDeposit } = await client.getFreeBalance(
            tokenAddress,
          );
          expect(postDeposit).to.be.eq("1");
          res();
        });
        await sendOnchainValue(client.multisigAddress, 1, tokenAddress);
      },
    );
  });
});
