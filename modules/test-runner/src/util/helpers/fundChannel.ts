import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: string = AddressZero,
): Promise<void> => {
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async resolve => {
    client.once("DEPOSIT_CONFIRMED_EVENT", async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(amount);
      expect(freeBalance[client.freeBalanceAddress]).toBeBigNumberEq(expected);
      resolve();
    });

    await client.deposit({ amount: amount.toString(), assetId });
  });

  return;
};
