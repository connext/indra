import { IConnextClient } from "@connext/types";
import { AddressZero, One, Zero } from "ethers/constants";

import { createClient, ethProvider, ethWallet } from "../util";

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
    const balance = await ethProvider.getBalance(clientA.multisigAddress);
    expect(balance).toBeBigNumberEq(0);
    ethProvider.on(clientA.multisigAddress, async () => {
      const balance = await ethProvider.getBalance(clientA.multisigAddress);
      expect(balance).toBeBigNumberEq(1);
      await clientA.rescindDepositRights({ assetId: AddressZero });
      const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
        AddressZero,
      );
      expect(postDeposit).toBeBigNumberEq(1);
      done();
    });
    await ethWallet.sendTransaction({ to: clientA.multisigAddress, value: One });
  });
});
