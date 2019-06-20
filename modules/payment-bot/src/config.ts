import { confirmPostgresConfigurationEnvVars } from "@counterfactual/postgresql-node-connector";
import "dotenv";

confirmPostgresConfigurationEnvVars();

if (!process.env.PRIVATE_KEY) {
  throw Error("No private key specified in env. Exiting.");
}

if (!process.env.NODE_URL || !process.env.NODE_URL.startsWith("nats://")) {
  throw Error("No accurate node url specified in env. Exiting.");
}

const args = process.argv.slice(2);
const ethNetwork = process.env.ETHEREUM_NETWORK || "ganache";

export const config = {
  action: args[0] || "none",
  args: args.length > 1 ? args.slice(1) : [],
  baseUrl: process.env.BASE_URL || "https://localhost:8080",
  delaySeconds: process.env.DELAY_SECONDS ? Number(process.env.DELAY_SECONDS) : 5,
  ethNetwork,
  ethRpcUrl: process.env.ETHEREUM_NETWORK || `https://${ethNetwork}.infura.io/metamask`,
  intermediaryIdentifier: process.env.INTERMEDIARY_IDENTIFIER,
  nodeMnemonic: process.env.NODE_MNEMONIC,
  nodeUrl: process.env.NODE_URL,
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
