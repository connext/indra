import { confirmPostgresConfigurationEnvVars } from "@counterfactual/postgresql-node-connector";
import "dotenv";

confirmPostgresConfigurationEnvVars();

if (!process.env.PRIVATE_KEY) {
  throw Error("No private key specified in env. Exiting.");
}

if (!process.env.NATS_URL || !process.env.NATS_URL.startsWith("nats://")) {
  throw Error(`No valid nats url specified in env: ${process.env.NATS_URL} Exiting.`);
}

if (!process.env.NODE_URL) {
  throw Error("No node url specified in env. Exiting.");
}

const args = process.argv.slice(2);
const ethNetwork = process.env.ETHEREUM_NETWORK || "ganache";

export const config = {
  action: args[0] || "none",
  args: args.length > 1 ? args.slice(1) : [],
  delaySeconds: process.env.DELAY_SECONDS ? Number(process.env.DELAY_SECONDS) : 5,
  ethNetwork,
  ethRpcUrl: process.env.ETHEREUM_NETWORK || `https://${ethNetwork}.infura.io/metamask`,
  intermediaryIdentifier: process.env.INTERMEDIARY_IDENTIFIER,
  natsUrl: process.env.NATS_URL || "nats://localhost:4222",
  nodeMnemonic: process.env.NODE_MNEMONIC,
  nodeUrl: process.env.NODE_URL || "http://localhost:8080",
  postgres: {
    database: process.env.POSTGRES_DATABASE!,
    host: process.env.POSTGRES_HOST!,
    password: process.env.POSTGRES_PASSWORD!,
    port: parseInt(process.env.POSTGRES_PORT!, 10),
    type: "postgres" as any, // supposed to be an "expo" type, not a string? wtf mate?
    username: process.env.POSTGRES_USER!,
  },
  privateKey: process.env.PRIVATE_KEY,
  username: process.env.USERNAME || "unknown",
};
