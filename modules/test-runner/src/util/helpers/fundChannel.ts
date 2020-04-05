import { IConnextClient, EventNames, delay } from "@connext/types";
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
    client.once(EventNames.DEPOSIT_CONFIRMED_EVENT, async () => {
      const freeBalance = await client.getFreeBalance(assetId);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.freeBalanceAddress].add(amount);
      expect(freeBalance[client.freeBalanceAddress]).to.equal(expected);
      log.info(`Got deposit confirmed event, helper wrapper is returning`);
      resolve();
    });
    client.once(EventNames.DEPOSIT_FAILED_EVENT, async (msg: any) => {
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
  enforce: boolean = false,
): Promise<void> => {
  const log = new Logger("RequestCollateral", env.logLevel);
  log.debug(`client.requestCollateral() called`);
  const start = Date.now();
  await client.requestCollateral(assetId);
  log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
  const preCollateralBal = await client.getFreeBalance(assetId);

  return new Promise(async (resolve, reject) => {
    log.debug(`client.requestCollateral() called`);
    const start = Date.now();
    await client.requestCollateral(assetId);
    log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
    let currCollateralBal = await client.getFreeBalance(assetId);
    while (
      enforce &&
      currCollateralBal[
        client.nodeFreeBalanceAddress
      ].lte(preCollateralBal[client.nodeFreeBalanceAddress]) &&
      Date.now() - start > 5_000 // wait 5s
    ) {
      await delay(500);
      currCollateralBal = await client.getFreeBalance(assetId);
    }
    if (Date.now() - start > 5_000 && enforce) {
      reject(`No collateral received after 5s in channel ${client.multisigAddress}`);
      return;
    }
    resolve();
  });
};
