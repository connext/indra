import {
  AssetId,
  CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  delay,
  EventNames,
  getAddressFromAssetId,
  IConnextClient,
} from "@connext/types";
import { BigNumber } from "ethers/utils";

import { env, expect, Logger } from "../";

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
): Promise<void> => {
  const log = new Logger("FundChannel", env.logLevel);
  const tokenAddress = getAddressFromAssetId(assetId);
  const prevFreeBalance = await client.getFreeBalance(tokenAddress);
  await new Promise(async (resolve, reject) => {
    client.once(EventNames.DEPOSIT_CONFIRMED_EVENT, async () => {
      const freeBalance = await client.getFreeBalance(tokenAddress);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.signerAddress].add(amount);
      expect(freeBalance[client.signerAddress]).to.equal(expected);
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
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
  enforce: boolean = false,
): Promise<void> => {
  const log = new Logger("RequestCollateral", env.logLevel);
  const tokenAddress = getAddressFromAssetId(assetId);
  const preCollateralBal = await client.getFreeBalance(tokenAddress);

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
            const currBal = await client.getFreeBalance(tokenAddress);
            if (
              currBal[client.nodeSignerAddress]
                .lte(preCollateralBal[client.nodeSignerAddress])
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
