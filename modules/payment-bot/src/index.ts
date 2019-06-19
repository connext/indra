import * as connext from "@connext/client";
import { MNEMONIC_PATH } from "@counterfactual/node";
import {
  confirmPostgresConfigurationEnvVars,
  PostgresServiceFactory,
} from "@counterfactual/postgresql-node-connector";
import * as eth from "ethers";

import { showMainPrompt } from "./bot";

const baseUrl = process.env.BASE_URL!;
const NETWORK = process.env.ETHEREUM_NETWORK || "kovan";
const ethUrl = process.env.ETHEREUM_NETWORK || `https://${NETWORK}.infura.io/metamask`;

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw Error("No private key specified in env. Exiting.");
}

const nodeUrl = process.env.NODE_URL;
if (!nodeUrl || !nodeUrl.startsWith("nats://")) {
  throw Error("No accurate node url specified in env. Exiting.");
}

process.on("warning", (e: any): any => console.warn(e.stack));

confirmPostgresConfigurationEnvVars();
const pgServiceFactory: PostgresServiceFactory = new PostgresServiceFactory({
  database: process.env.POSTGRES_DATABASE!,
  host: process.env.POSTGRES_HOST!,
  password: process.env.POSTGRES_PASSWORD!,
  port: parseInt(process.env.POSTGRES_PORT!, 10),
  type: "postgres",
  username: process.env.POSTGRES_USER!,
});

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
  const store = pgServiceFactory.createStoreService(process.env.USERNAME!);

  const connextOpts: connext.ClientOptions = {
    delete_this_url: baseUrl,
    nodeUrl: baseUrl,
    privateKey,
    rpcProviderUrl: ethUrl,
    store,
  };

  console.log("Using client options:");
  console.log("     - rpcProviderUrl:", ethUrl);
  console.log("     - nodeUrl:", nodeUrl);
  console.log("     - privateKey:", privateKey);

  console.log("process.env.NODE_MNEMONIC: ", process.env.NODE_MNEMONIC);
  await store.set([{ key: MNEMONIC_PATH, value: process.env.NODE_MNEMONIC }]);

  try {
    console.log("Creating connext");
    client = await connext.connect(connextOpts);
    console.log("Client created successfully!");

    const config = await client.config();
    console.log("Config:", config);

    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    if (process.env.DEPOSIT_AMOUNT) {
      const depositParams: connext.DepositParameters = {
        amount: eth.utils.parseEther(process.env.DEPOSIT_AMOUNT).toString(),
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
