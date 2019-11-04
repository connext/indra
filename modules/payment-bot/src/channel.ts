import * as connext from "@connext/client";
import { makeChecksum } from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { config } from "./config";
import { Store } from "./store";
import { logEthFreeBalance } from "./utils";

export const getOrCreateChannel = async (assetId?: string): Promise<connext.ConnextClient> => {
  const store = new Store();

  const connextOpts: connext.ClientOptions = {
    ethProviderUrl: config.ethProviderUrl,
    logLevel: config.logLevel,
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    store,
  };
  const client = await connext.connect(connextOpts);
  const nodeFBAddress = connext.utils.freeBalanceAddressFromXpub(client.nodePublicIdentifier);
  console.log("Payment bot launched:");
  console.log(` - mnemonic: ${connextOpts.mnemonic}`);
  console.log(` - ethProviderUrl: ${connextOpts.ethProviderUrl}`);
  console.log(` - nodeUrl: ${connextOpts.nodeUrl}`);
  console.log(` - publicIdentifier: ${client.publicIdentifier}`);
  console.log(` - multisigAddress: ${client.opts.multisigAddress}`);
  console.log(` - User freeBalanceAddress: ${client.freeBalanceAddress}`);
  console.log(` - Node freeBalance address: ${nodeFBAddress}`);

  const channelAvailable = async (): Promise<boolean> => {
    const channel = await client.getChannel();
    return channel && channel.available;
  };
  const interval = 0.1;
  while (!(await channelAvailable())) {
    console.info(`Waiting ${interval} more seconds for channel to be available`);
    await new Promise((res: any): any => setTimeout((): void => res(), interval * 1000));
  }
  await client.addPaymentProfile({
    amountToCollateralize: parseEther("0.1").toString(),
    assetId: AddressZero,
    minimumMaintainedCollateral: parseEther("0.01").toString(),
  });
  if (assetId) {
    await client.addPaymentProfile({
      amountToCollateralize: parseEther("10").toString(),
      assetId: makeChecksum(assetId),
      minimumMaintainedCollateral: parseEther("5").toString(),
    });
  }
  console.info(`Channel is available!`);

  client.on(
    CFCoreTypes.EventName.UNINSTALL_VIRTUAL,
    async (data: CFCoreTypes.UninstallVirtualResult): Promise<void> => {
      console.log(`Bot event caught: ${CFCoreTypes.EventName.UNINSTALL_VIRTUAL}`);
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      if (assetId) {
        logEthFreeBalance(assetId, await client.getFreeBalance(assetId));
      }
    },
  );

  client.on(
    CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED,
    async (data: any): Promise<void> => {
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      if (assetId) {
        logEthFreeBalance(assetId, await client.getFreeBalance(assetId));
      }
    },
  );

  if (
    client.listener.listenerCount(CFCoreTypes.EventName.UNINSTALL_VIRTUAL) === 0 ||
    client.listener.listenerCount(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED) === 0
  ) {
    throw Error("Listeners failed to register.");
  }

  return client;
};
