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
  const preCollateralBal = await client.getFreeBalance(assetId);

  return new Promise(async (resolve, reject) => {
    log.debug(`client.requestCollateral() called`);
    const start = Date.now();
    if (!enforce) {
      try {
        await client.requestCollateral(assetId);
        log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
        return resolve();
      } catch (e) {
        return reject(e);
      }
    }
    // watch for balance change on uninstall
    try {
      await Promise.race([
        new Promise(async (res, rej) => {
          await delay(20_000);
          return rej(`Could not detect increase in node free balance within 20s`);
        }),
        new Promise(async res => {
          client.on(
            EventNames.UNINSTALL_EVENT,
            async () => {
            const currBal = await client.getFreeBalance(assetId);
            if (
              currBal[client.nodeFreeBalanceAddress]
                .lte(preCollateralBal[client.nodeFreeBalanceAddress])
            ) {
              // no increase in bal
              return;
            }
            // otherwise resolve
            return res();
          });
          await client.requestCollateral(assetId);
        }),
      ]);
      log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
      resolve();
    } catch (e) {
      return reject(e);
    }
  });
};
