import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

export const fundChannel = async (
  client: IConnextClient,
  amount: string, // ETH string
  assetId: string = AddressZero,
): Promise<void> => {
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async resolve => {
    client.once("DEPOSIT_CONFIRMED_EVENT", async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(parseEther(amount));
      expect(freeBalance[client.freeBalanceAddress]).toBeBigNumberEq(expected);
      resolve();
    });

    await client.deposit({ amount: parseEther(amount).toString(), assetId });
  });

  return;
};
