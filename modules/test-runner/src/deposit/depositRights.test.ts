import { IConnextClient } from "@connext/types";
import { AddressZero, One } from "ethers/constants";

import { createClient, ethProvider, ethWallet, getOnchainBalance, sendOnchainValue } from "../util";

describe("Deposits", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  }, 90_000);

  // tslint:disable-next-line:max-line-length
  test("happy case: client should request deposit rights and deposit ETH", async (done: jest.DoneCallback) => {
    await clientA.requestDepositRights({ assetId: AddressZero });
    const { [clientA.freeBalanceAddress]: preDeposit } = await clientA.getFreeBalance(AddressZero);
    expect(preDeposit).toBeBigNumberEq(0);

    // listen for tx to multisig address
    const balance = await getOnchainBalance(clientA.multisigAddress);
    expect(balance).toBeBigNumberEq(0);
    ethProvider.on(clientA.multisigAddress, async () => {
      const balance = await getOnchainBalance(clientA.multisigAddress);
      expect(balance).toBeBigNumberEq(1);
      await clientA.rescindDepositRights({ assetId: AddressZero });
      const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
        AddressZero,
      );
      expect(postDeposit).toBeBigNumberEq(1);
      done();
    });
    await sendOnchainValue(clientA.multisigAddress, 1);
  });

  // tslint:disable-next-line:max-line-length
  test("happy case: client should request deposit rights and deposit token", async (done: jest.DoneCallback) => {
    const tokenAddress = clientA.config.contractAddresses.Token;
    await clientA.requestDepositRights({ assetId: tokenAddress });
    const { [clientA.freeBalanceAddress]: preDeposit } = await clientA.getFreeBalance(tokenAddress);
    expect(preDeposit).toBeBigNumberEq(0);

    // listen for tx to multisig address
    const balance = await getOnchainBalance(clientA.multisigAddress, tokenAddress);
    expect(balance).toBeBigNumberEq(0);
    ethProvider.on(clientA.multisigAddress, async () => {
      const balance = await getOnchainBalance(clientA.multisigAddress, tokenAddress);
      expect(balance).toBeBigNumberEq(1);
      await clientA.rescindDepositRights({ assetId: tokenAddress });
      const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
        tokenAddress,
      );
      expect(postDeposit).toBeBigNumberEq(1);
      done();
    });
    await sendOnchainValue(clientA.multisigAddress, 1, tokenAddress);
  });
});
