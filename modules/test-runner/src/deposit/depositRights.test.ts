import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient, ethProvider, expect, getOnchainBalance, sendOnchainValue } from "../util";

// TODO: fix errors here
describe("Deposits", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  });

  it("happy case: client should request deposit rights and deposit ETH", async () => {
    await clientA.requestDepositRights({ assetId: AddressZero });
    const { [clientA.freeBalanceAddress]: preDeposit } = await clientA.getFreeBalance(AddressZero);
    expect(preDeposit.toString()).to.be.eq("0");
    const balance = await getOnchainBalance(clientA.multisigAddress);
    expect(balance.toString()).to.be.eq("0");
    await new Promise(
      async (res: any): Promise<any> => {
        ethProvider.on(clientA.multisigAddress, async () => {
          const balance = await getOnchainBalance(clientA.multisigAddress);
          expect(balance.toString()).to.be.eq("1");
          await clientA.rescindDepositRights({ assetId: AddressZero });
          const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
            AddressZero,
          );
          expect(postDeposit.toString()).to.be.eq("1");
          res();
        });
        await sendOnchainValue(clientA.multisigAddress, 1);
      },
    );
  });

  it("happy case: client should request deposit rights and deposit token", async () => {
    const tokenAddress = clientA.config.contractAddresses.Token;
    await clientA.requestDepositRights({ assetId: tokenAddress });
    const { [clientA.freeBalanceAddress]: preDeposit } = await clientA.getFreeBalance(tokenAddress);
    expect(preDeposit.toString()).to.be.eq("0");
    const balance = await getOnchainBalance(clientA.multisigAddress, tokenAddress);
    expect(balance.toString()).to.be.eq("0");
    await new Promise(
      async (res: any, rej: any): Promise<any> => {
        ethProvider.on(clientA.multisigAddress, async () => {
          const balance = await getOnchainBalance(clientA.multisigAddress, tokenAddress);
          expect(balance.toString()).to.be.eq("1");
          await clientA.rescindDepositRights({ assetId: tokenAddress });
          const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
            tokenAddress,
          );
          expect(postDeposit.toString()).to.be.eq("1");
          res();
        });
        await sendOnchainValue(clientA.multisigAddress, 1, tokenAddress);
      },
    );
  });
});
