import * as connext from "@connext/client";
import { ConnextStore, FileStorage } from "@connext/store";
import {
  ClientOptions,
  IConnextClient,
  WITHDRAWAL_CONFIRMED_EVENT,
  UNINSTALL_VIRTUAL_EVENT,
} from "@connext/types";
import { AddressZero } from "ethers/constants";

import { config } from "./config";
import { logEthFreeBalance } from "./utils";

export const getOrCreateChannel = async (): Promise<IConnextClient> => {
  const fileStorage = new FileStorage({ fileDir: config.storeDir });
  const store = new ConnextStore(fileStorage);

  const connextOpts: ClientOptions = {
    ethProviderUrl: config.ethProviderUrl,
    logLevel: config.logLevel,
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    store,
  };
  const client = await connext.connect(connextOpts);
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

  client.on(
    UNINSTALL_VIRTUAL_EVENT,
    async (): Promise<void> => {
      console.log(`Bot event caught: ${UNINSTALL_VIRTUAL_EVENT}`);
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      logEthFreeBalance(
        client.config.contractAddresses.Token,
        await client.getFreeBalance(client.config.contractAddresses.Token),
      );
    },
  );

  client.on(
    WITHDRAWAL_CONFIRMED_EVENT,
    async (): Promise<void> => {
      console.log(`Bot event caught: ${WITHDRAWAL_CONFIRMED_EVENT}`);
      logEthFreeBalance(AddressZero, await client.getFreeBalance());
      logEthFreeBalance(
        client.config.contractAddresses.Token,
        await client.getFreeBalance(client.config.contractAddresses.Token),
      );
    },
  );

  return client;
};
