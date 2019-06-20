import * as connext from "@connext/client";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import * as eth from "ethers";

import { showMainPrompt } from "./bot";
import { config } from "./config";

process.on("warning", (e: any): any => console.warn(e.stack));

const pgServiceFactory: PostgresServiceFactory = new PostgresServiceFactory(config.postgres);

let client;

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
  console.log("     - rpcProviderUrl:", config.ethRpcUrl);
  console.log("     - nodeUrl:", config.nodeUrl);

  console.log("node mnemonic;", config.mnemonic);

  try {
    console.log("Creating connext");
    client = await connext.connect(connextOpts);
    process.exit();
    console.log("Client created successfully!");

    const config = await client.config();
    console.log("Config:", config);

    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    if (config.action === "deposit" && config.args[0]) {
      const depositParams = {
        amount: eth.utils.parseEther(config.args[0]).toString(),
      };
      await client.deposit(depositParams);
      console.log(`Successfully deposited ${depositParams.amount}!`);
      // await client.deposit(node, process.env.DEPOSIT_AMOUNT, client.multisigAddress);
    }

    // connext.afterUser(node, bot.nodeAddress, client.multisigAddress);
    connext.logEthFreeBalance(
      await connext.getFreeBalance(client.cfModule, client.publicIdentifier),
    );
    // @ts-ignore
    showMainPrompt(client.cfModule); // TODO: WHYYYYYYYYYYYYYYYYYYYYYYYYYYY? (╯°□°）╯︵ ┻━┻
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
