import { MNEMONIC_PATH, } from "@counterfactual/node";
import {
  confirmPostgresConfigurationEnvVars,
  POSTGRES_CONFIGURATION_ENV_KEYS,
  PostgresServiceFactory,
} from "@counterfactual/postgresql-node-connector";
import * as eth from "ethers";

import { showMainPrompt } from "./bot";
import * as connext from "../../client/src";

const BASE_URL = process.env.BASE_URL!;
const NETWORK = process.env.ETHEREUM_NETWORK || "kovan";

const ethUrl = process.env.ETHEREUM_NETWORK || `https://${NETWORK}.infura.io/metamask`;

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw Error("No private key specified in env. Exiting.");
}

const nodeUrl = process.env.NODE_URL;
if (!nodeUrl || !nodeUrl.startsWith('nats://')) {
  throw Error("No accurate node url specified in env. Exiting.");
}

let pgServiceFactory: PostgresServiceFactory;
// console.log(`Using Nats configuration for ${process.env.NODE_ENV}`);
// console.log(`Using Firebase configuration for ${process.env.NODE_ENV}`);

process.on("warning", e => console.warn(e.stack));

confirmPostgresConfigurationEnvVars();
pgServiceFactory = new PostgresServiceFactory({
  database: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.database]!,
  host: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.host]!,
  password: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.password]!,
  port: parseInt(process.env[POSTGRES_CONFIGURATION_ENV_KEYS.port]!, 10),
  type: "postgres",
  username: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.username]!,
});

let client: connext.ConnextInternal;
let bot;

export function getMultisigAddress() {
  return client.opts.multisigAddress;
}

export function getWalletAddress() {
  return client.wallet.address;
}

export function getBot() {
  return bot;
}

(async () => {
  await pgServiceFactory.connectDb();

  console.log("Creating store");
  const store = pgServiceFactory.createStoreService(process.env.USERNAME!);

  const connextOpts: connext.ClientOptions = {
    delete_this_url: BASE_URL,
    rpcProviderUrl: ethUrl,
    nodeUrl,
    privateKey,
    loadState: store.get,
    saveState: store.set,
  }

  console.log("Using client options:");
  console.log("     - rpcProviderUrl:", ethUrl);
  console.log("     - nodeUrl:", nodeUrl);
  console.log("     - privateKey:", privateKey);

  console.log("process.env.NODE_MNEMONIC: ", process.env.NODE_MNEMONIC);
  await store.set([{ key: MNEMONIC_PATH, value: process.env.NODE_MNEMONIC }]);

  try {
    console.log("Creating connext");
    const client = await connext.connect(connextOpts);
    console.log("Client created successfully!");

    console.log("Public Identifier", client.publicIdentifier);
    console.log("Account multisig address:", client.opts.multisigAddress);

    if (process.env.DEPOSIT_AMOUNT) {
      const depositParams: connext.DepositParameters = {
        amount: eth.utils.parseEther(process.env.DEPOSIT_AMOUNT).toString(),
      }
      await client.deposit(depositParams)
      console.log(`Successfully deposited ${depositParams.amount}!`)
      // await client.deposit(node, process.env.DEPOSIT_AMOUNT, client.multisigAddress);
    }

    // connext.afterUser(node, bot.nodeAddress, client.multisigAddress);
    connext.logEthFreeBalance(await connext.getFreeBalance(client.cfModule, client.publicIdentifier));
    //@ts-ignore
    showMainPrompt(client.cfModule); //TODO: WHYYYYYYYYYYYYYYYYYYYYYYYYYYY? (╯°□°）╯︵ ┻━┻
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
