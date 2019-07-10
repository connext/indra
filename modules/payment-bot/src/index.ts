import * as connext from "@connext/client";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import * as eth from "ethers";

import { registerClientListeners, showMainPrompt } from "./bot";
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

  const connextOpts = {
    mnemonic: config.mnemonic,
    natsUrl: config.natsUrl,
    nodeUrl: config.nodeUrl,
    rpcProviderUrl: config.ethRpcUrl,
    store: pgServiceFactory.createStoreService(config.username),
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
    const interval = 3;
    while (!(await channelAvailable())) {
      console.info(`Waiting ${interval} more seconds for channel to be available`);
      await new Promise((res: any): any => setTimeout(() => res(), interval * 1000));
    }
    console.log(`action: ${config.action}, args: ${config.args}`);
    if (config.action === "deposit") {
      const depositParams = {
        amount: eth.utils.parseEther(config.args[0]).toString(),
      };
      console.log(`Attempting to deposit ${depositParams.amount}...`);
      await client.deposit(depositParams);
      console.log(`Successfully deposited!`);
    }

    registerClientListeners();

    client.logEthFreeBalance(await client.getFreeBalance());

    showMainPrompt();
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
