import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

export const fundChannel = async (
  client: IConnextClient,
  amount: string, // ETH string, only included if not collateral
  assetId: string = AddressZero,
): Promise<void> => {
  const prevFreeBalance = await client.getFreeBalance();
  await new Promise(async resolve => {
    // TODO: should add `once` to top level client
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
