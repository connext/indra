import { Node as CFCoreTypes } from "@counterfactual/types";
import { AddressZero } from "ethers/constants";

import { getAssetId, getConnextClient } from "./";
import { logEthFreeBalance } from "./utils";

export const delay = (ms: number): Promise<void> =>
  new Promise((res: any): any => setTimeout(res, ms));

export function registerClientListeners(): void {
  const client = getConnextClient();

  client.on(
    CFCoreTypes.EventName.UNINSTALL_VIRTUAL,
    async (data: CFCoreTypes.UninstallVirtualResult) => {
      console.log(`Bot event caught: ${CFCoreTypes.EventName.UNINSTALL_VIRTUAL}`);
      while ((await client.getAppInstances()).length > 0) {
        console.log(
          "app still found in client, waiting 1s to uninstall. open apps: ",
          (await client.getAppInstances()).length,
        );
        await delay(1000);
      }
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      if (getAssetId()) {
        logEthFreeBalance(getAssetId(), await client.getFreeBalance(getAssetId()));
      }
    },
  );

  client.on(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED, async (data: any) => {
    logEthFreeBalance(AddressZero, await client.getFreeBalance());
    if (getAssetId()) {
      logEthFreeBalance(getAssetId(), await client.getFreeBalance(getAssetId()));
    }
  });

  if (
    client.listener.listenerCount(CFCoreTypes.EventName.UNINSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED) === 0
  ) {
    throw Error("Listeners failed to register.");
  }
}
