import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, DEPOSIT_CONFIRMED_EVENT, DEPOSIT_FAILED_EVENT } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { env, expect, Logger } from "../";

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: string = AddressZero,
): Promise<void> => {
  const log = new Logger("FundChannel", env.logLevel);
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async (resolve, reject) => {
    client.once(DEPOSIT_CONFIRMED_EVENT, async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(amount);
      expect(freeBalance[client.freeBalanceAddress]).to.equal(expected);
      log.info(`Got deposit confirmed event, helper wrapper is returning`);
      resolve();
    });
    client.once(DEPOSIT_FAILED_EVENT, async (msg: any) => {
      reject(new Error(JSON.stringify(msg)));
    });

    try {
      // FYI this function returns after fundChannel has returned (at resolve above)
      log.debug(`client.deposit() called`);
      const start = Date.now();
      await client.deposit({ amount: amount.toString(), assetId });
      log.info(`client.deposit() returned in ${Date.now() - start}`);
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
  const log = new Logger("RequestCollateral", env.logLevel);
  const nodeFreeBalanceAddress = xkeyKthAddress(client.nodePublicIdentifier);
  const prevFreeBalance = await client.getFreeBalance(assetId);
  await new Promise(async (resolve, reject) => {
    client.once("DEPOSIT_CONFIRMED_EVENT", async data => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      expect(freeBalance[nodeFreeBalanceAddress]).to.be.above(
        prevFreeBalance[nodeFreeBalanceAddress],
      );
      log.info(`Got deposit confirmed event, helper wrapper is returning`);
      resolve();
    });
    client.once(DEPOSIT_FAILED_EVENT, async (msg: any) => {
      reject(new Error(JSON.stringify(msg)));
    });

    try {
      log.debug(`client.requestCollateral() called`);
      const start = Date.now();
      await client.requestCollateral(assetId);
      log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
    } catch (e) {
      return reject(new Error(e.stack || e.message));
    }
  });

  return;
};
