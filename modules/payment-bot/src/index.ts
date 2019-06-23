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

    const config = await client.config();
    console.log("Config:", config);

    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);
    if (process.argv[2]) {
      const depositParams = {
        amount: eth.utils.parseEther(process.argv[3]).toString(),
      };
      console.log(`Attempting to deposit ${depositParams.amount}...`);
      await client.deposit(depositParams);
      console.log(`Successfully deposited!`);
    }

    // connext.afterUser(node, bot.nodeAddress, client.multisigAddress);
    client.logEthFreeBalance(await client.getFreeBalance());
    // @ts-ignore
    showMainPrompt(client.cfModule); // TODO: WHYYYYYYYYYYYYYYYYYYYYYYYYYYY? (╯°□°）╯︵ ┻━┻
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
