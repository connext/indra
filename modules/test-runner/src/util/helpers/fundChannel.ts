import {
  AssetId,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  IConnextClient,
  EventPayloads,
} from "@connext/types";
import { ColorfulLogger, getAddressFromAssetId } from "@connext/utils";
import { BigNumber } from "ethers";

import { env, expect } from "../";
import { getTestLoggers } from "../misc";

const { log, timeElapsed } = getTestLoggers("FundHelper");

export const fundChannel = async (
  client: IConnextClient,
  amount: BigNumber,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID,
): Promise<void> => {
  const start = Date.now();
  const tokenAddress = getAddressFromAssetId(assetId);
  const prevFreeBalance = await client.getFreeBalance(tokenAddress);

  await new Promise(async (resolve, reject) => {
    let syncFailed = false;
    client.once(EventNames.SYNC_FAILED_EVENT, (msg) => {
      syncFailed = true;
    });
    // register failure listeners
    client.once(EventNames.DEPOSIT_FAILED_EVENT, async (msg: EventPayloads.DepositFailed) => {
      return reject(new Error(msg.error));
    });
    client.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, async (msg: EventPayloads.ProposeFailed) => {
      if (!syncFailed) {
        return;
      }
      return reject(new Error(msg.error));
    });
    client.on(EventNames.INSTALL_FAILED_EVENT, async (msg: EventPayloads.InstallFailed) => {
      if (!syncFailed) {
        return;
      }
      return reject(new Error(msg.error));
    });
    client.on(EventNames.UNINSTALL_FAILED_EVENT, async (msg: EventPayloads.UninstallFailed) => {
      if (!syncFailed) {
        return;
      }
      return reject(new Error(msg.error));
    });
    try {
      // FYI this function returns after fundChannel has returned (at resolve above)
      log.debug(`client.deposit() called`);
      const start = Date.now();
      const response = await client.deposit({ amount: amount.toString(), assetId });
      // TODO: remove this check once backwards compatibility is not needed
      if (response.completed) {
        await response.completed();
      }
      const freeBalance = await client.getFreeBalance(tokenAddress);
      // verify free balance increased as expected
      const expected = prevFreeBalance[client.signerAddress].add(amount);
      expect(freeBalance[client.signerAddress]).to.equal(expected);
      log.debug(`Got deposit confirmed event, helper wrapper is returning`);
      log.debug(`client.deposit() returned in ${Date.now() - start}`);
      return resolve();
    } catch (e) {
      return reject(e);
    }
  });

  timeElapsed(`Funded client ${client.publicIdentifier}`, start);
  return;
};

export const requestCollateral = async (
  client: IConnextClient,
  assetId: AssetId = CONVENTION_FOR_ETH_ASSET_ID,
  enforce: boolean = false,
): Promise<void> => {
  const log = new ColorfulLogger("RequestCollateral", env.logLevel, false, "H");
  const tokenAddress = getAddressFromAssetId(assetId);
  const preCollateralBal = await client.getFreeBalance(tokenAddress);
  log.debug(`calling client.requestCollateral()`);
  const start = Date.now();
  const res = await client.requestCollateral(assetId);
  log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
  if (!enforce) {
    res && (await res.completed());
    return;
  }
  if (!res) {
    throw new Error("Node did not collateralize, and collateral should be enforced");
  }
  log.info(`waiting for collateral tx to be mined and ap to be uninstalled`);
  const { freeBalance } = await res.completed();
  log.info(`client.requestCollateral() returned in ${Date.now() - start}`);
  if (freeBalance[client.nodeSignerAddress].lt(preCollateralBal[client.nodeSignerAddress])) {
    throw new Error("Expected increase in balance following collateralization");
  }
};
