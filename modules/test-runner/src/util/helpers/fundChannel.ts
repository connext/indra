import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, DEPOSIT_CONFIRMED_EVENT, DEPOSIT_FAILED_EVENT } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { expect } from "../";

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: string = AddressZero,
): Promise<void> => {
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async (resolve, reject) => {
    client.once(DEPOSIT_CONFIRMED_EVENT, async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(amount);
      expect(freeBalance[client.freeBalanceAddress]).to.equal(expected);
      resolve();
    });
    client.once(DEPOSIT_FAILED_EVENT, async (msg: any) => {
      reject(new Error(JSON.stringify(msg)));
    });

    try {
      await client.deposit({ amount: amount.toString(), assetId });
    } catch (e) {
      return reject(new Error(e.stack || e.message));
    }
  });

  return;
};

export const requestCollateral = async (
  client: IConnextClient,
  assetId: string = AddressZero,
): Promise<void> => {
  const nodeFreeBalanceAddress = xkeyKthAddress(client.nodePublicIdentifier);
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async (resolve, reject) => {
    client.once(`DEPOSIT_CONFIRMED_EVENT`, async data => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      expect(freeBalance[nodeFreeBalanceAddress]).to.be.above(
        prevFreeBalance[nodeFreeBalanceAddress],
      );
      resolve();
    });
    client.once(DEPOSIT_FAILED_EVENT, async (msg: any) => {
      reject(new Error(JSON.stringify(msg)));
    });

    try {
      await client.requestCollateral(assetId);
    } catch (e) {
      return reject(new Error(e.stack || e.message));
    }
  });

  return;
};
