import { MNEMONIC_PATH, Node } from "@counterfactual/node";
import {
  confirmPostgresConfigurationEnvVars,
  POSTGRES_CONFIGURATION_ENV_KEYS,
  PostgresServiceFactory,
} from "@counterfactual/postgresql-node-connector";
import { ethers } from "ethers";

import { NatsServiceFactory } from "../../nats-messaging-client/src/index";

import { showMainPrompt } from "./bot";
import {
  afterUser,
  createAccount,
  deposit,
  fetchMultisig,
  getFreeBalance,
  getUser,
  logEthFreeBalance,
  UserSession,
} from "./utils";

const BASE_URL = process.env.BASE_URL!;
const NETWORK = process.env.ETHEREUM_NETWORK || "kovan";

const provider = new ethers.providers.JsonRpcProvider(
  `https://${NETWORK}.infura.io/metamask`,
);

let pgServiceFactory: PostgresServiceFactory;
let natsServiceFactory: NatsServiceFactory;
// console.log(`Using Nats configuration for ${process.env.NODE_ENV}`);
// console.log(`Using Firebase configuration for ${process.env.NODE_ENV}`);

process.on("warning", e => console.warn(e.stack));

// FIXME for non local testing
// @ts-ignore
natsServiceFactory = new NatsServiceFactory();

confirmPostgresConfigurationEnvVars();
pgServiceFactory = new PostgresServiceFactory({
  type: "postgres",
  database: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.database]!,
  host: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.host]!,
  password: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.password]!,
  port: parseInt(process.env[POSTGRES_CONFIGURATION_ENV_KEYS.port]!, 10),
  username: process.env[POSTGRES_CONFIGURATION_ENV_KEYS.username]!,
});

let node: Node;

let multisigAddress: string;
let walletAddress: string;
let bot: UserSession;

export function getMultisigAddress() {
  return multisigAddress;
}

export function getWalletAddress() {
  return walletAddress;
}

export function getBot() {
  return bot;
}

(async () => {
  await pgServiceFactory.connectDb();

  console.log("Creating store");
  const store = pgServiceFactory.createStoreService(process.env.USERNAME!);

  console.log("process.env.NODE_MNEMONIC: ", process.env.NODE_MNEMONIC);
  await store.set([{ key: MNEMONIC_PATH, value: process.env.NODE_MNEMONIC }]);

  console.log("Creating Node");
  const messService = natsServiceFactory.createMessagingService("messaging");
  await messService.connect();
  node = await Node.create(
    messService,
    store,
    {
      STORE_KEY_PREFIX: "store",
    },
    // @ts-ignore
    provider,
    NETWORK,
  );

  console.log("Public Identifier", node.publicIdentifier);

  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw Error("No private key specified in env. Exiting.");
    }
    const wallet = new ethers.Wallet(privateKey, provider);
    walletAddress = wallet.address;
    const user = {
      email: "PaymentBot",
      ethAddress: wallet.address,
      nodeAddress: node.publicIdentifier,
      username: process.env.USERNAME || "PaymentBot",
    };

    bot = await getUser(BASE_URL, wallet.address);
    if (bot && bot.ethAddress) {
      console.log(
        `Getting pre-existing user ${user.username} account: ${wallet.address}`,
      );
      console.log(`Existing account found\n`, bot);
    } else {
      bot = await createAccount(BASE_URL, user);
      console.log(`Account created\n`, bot);
    }

    multisigAddress = await fetchMultisig(BASE_URL, wallet.address!);
    console.log("Account multisig address:", multisigAddress);

    if (process.env.DEPOSIT_AMOUNT) {
      await deposit(node, process.env.DEPOSIT_AMOUNT, multisigAddress);
    }

    afterUser(user.username, node, bot.nodeAddress, multisigAddress);
    logEthFreeBalance(await getFreeBalance(node, multisigAddress));
    showMainPrompt(node);
  } catch (e) {
    console.error("\n");
    console.error(e);
    console.error("\n");
    process.exit(1);
  }
})();
