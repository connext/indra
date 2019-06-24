import * as connext from "@connext/client";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import * as eth from "ethers";

import { showMainPrompt } from "./bot";
import { config } from "./config";

process.on("warning", (e: any): any => console.warn(e.stack));

const pgServiceFactory: PostgresServiceFactory = new PostgresServiceFactory(config.postgres);

let client: connext.ConnextInternal;

export function getMultisigAddress(): string {
  return client.opts.multisigAddress;
}

export function getWalletAddress(): string {
  return client.wallet.address;
}

export function getConnextClient(): connext.ConnextInternal {
  return client;
}

(async (): Promise<void> => {
  await pgServiceFactory.connectDb();

  console.log("Creating store");
  const store = pgServiceFactory.createStoreService(config.username);

  const connextOpts = {
    mnemonic: config.mnemonic,
    natsUrl: config.natsUrl,
    nodeUrl: config.nodeUrl,
    rpcProviderUrl: config.ethRpcUrl,
    store,
  };

  console.log("Using client options:");
  console.log("     - mnemonic:", config.mnemonic);
  console.log("     - rpcProviderUrl:", config.ethRpcUrl);
  console.log("     - natsUrl:", config.natsUrl);
  console.log("     - nodeUrl:", config.nodeUrl);

  try {
    console.log("Creating connext");
    client = await connext.connect(connextOpts);
    console.log("Client created successfully!");

    const connextConfig = await client.config();
    console.log("connextConfig:", connextConfig);

    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    const channelAvailable = async (): Promise<boolean> => (await client.getChannel()).available;
    while (!(await channelAvailable())) {
      console.info(`Waiting 1 more seconds for channel to be available`);
      await new Promise((res: any): any => setTimeout(() => res(), 1 * 1000));
    }
    if (process.argv[4]) {
      const depositParams = {
        amount: eth.utils.parseEther(process.argv[4]).toString(),
      };
      console.log(`Attempting to deposit ${depositParams.amount}...`);
      await client.deposit(depositParams);
      console.log(`Successfully deposited!`);
    }

    client.logEthFreeBalance(await client.getFreeBalance());

    showMainPrompt();
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
