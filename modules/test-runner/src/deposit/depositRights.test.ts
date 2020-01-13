import { IConnextClient } from "@connext/types";
import { AddressZero, One } from "ethers/constants";

import { createClient, ethProvider, ethWallet } from "../util";

describe("Deposits", () => {
  let clientA: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
  }, 90_000);

  // tslint:disable-next-line:max-line-length
  test.only("happy case: client should request deposit rights and deposit ETH", async (done: jest.DoneCallback) => {
    await clientA.requestDepositRights({ assetId: AddressZero });
    await clientA.rescindDepositRights({ assetId: AddressZero });
    const { [clientA.freeBalanceAddress]: preDeposit } = await clientA.getFreeBalance(AddressZero);
    expect(preDeposit).toBeBigNumberEq(One);

    // listen for tx to multisig address
    ethProvider.on(clientA.multisigAddress, async () => {
      await clientA.rescindDepositRights({ assetId: AddressZero });
      const { [clientA.freeBalanceAddress]: postDeposit } = await clientA.getFreeBalance(
        AddressZero,
      );
      expect(postDeposit).toBeBigNumberEq(One);
      done();
    });
    await ethWallet.sendTransaction({ to: clientA.multisigAddress, value: One });
  });
});
