import * as connext from "@connext/client";
import { CFCoreTypes, ClientOptions, IConnextClient, makeChecksum } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { config } from "./config";
import { Store } from "./store";
import { logEthFreeBalance } from "./utils";

export const getOrCreateChannel = async (): Promise<IConnextClient> => {
  const store = new Store();

  const connextOpts: ClientOptions = {
    ethProviderUrl: config.ethProviderUrl,
    logLevel: config.logLevel,
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    store,
  };
  const client = await connext.connect(connextOpts);
  await client.isAvailable();
  const nodeFBAddress = connext.utils.xpubToAddress(client.nodePublicIdentifier);
  console.log("Payment bot launched:");
  console.log(` - mnemonic: ${connextOpts.mnemonic}`);
  console.log(` - ethProviderUrl: ${connextOpts.ethProviderUrl}`);
  console.log(` - nodeUrl: ${connextOpts.nodeUrl}`);
  console.log(` - publicIdentifier: ${client.publicIdentifier}`);
  console.log(` - multisigAddress: ${client.multisigAddress}`);
  console.log(` - User freeBalanceAddress: ${client.freeBalanceAddress}`);
  console.log(` - Node freeBalance address: ${nodeFBAddress}`);
  console.log(` - token address: ${client.config.contractAddresses.Token}`);

  await client.addPaymentProfile({
    amountToCollateralize: parseEther("0.1").toString(),
    assetId: AddressZero,
    minimumMaintainedCollateral: parseEther("0.01").toString(),
  });

  await client.addPaymentProfile({
    amountToCollateralize: parseEther("10").toString(),
    assetId: makeChecksum(client.config.contractAddresses.Token),
    minimumMaintainedCollateral: parseEther("5").toString(),
  });

  client.on(
    "UNINSTALL_VIRTUAL_EVENT",
    async (): Promise<void> => {
      console.log(`Bot event caught: "UNINSTALL_VIRTUAL_EVENT"`);
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      logEthFreeBalance(
        client.config.contractAddresses.Token,
        await client.getFreeBalance(client.config.contractAddresses.Token),
      );
    },
  );

  client.on(
    "WITHDRAWAL_CONFIRMED_EVENT",
    async (): Promise<void> => {
      console.log(`Bot event caught: "WITHDRAWAL_CONFIRMED_EVENT"`);
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      logEthFreeBalance(
        client.config.contractAddresses.Token,
        await client.getFreeBalance(client.config.contractAddresses.Token),
      );
    },
  );

  return client;
};
