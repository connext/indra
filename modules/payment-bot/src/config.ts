import { confirmPostgresConfigurationEnvVars } from "@counterfactual/postgresql-node-connector";
import "dotenv";

confirmPostgresConfigurationEnvVars();

if (!process.env.NODE_URL) {
  throw Error("No node url specified in env. Exiting.");
}

if (!process.env.ETH_RPC_URL) {
  throw Error("No eth rpc url specified in env. Exiting.");
}

const args = process.argv.slice(2);

export const config = {
  action: args[0] || "none",
  args: args.length > 1 ? args.slice(1) : [],
  ethRpcUrl: process.env.ETH_RPC_URL,
  intermediaryIdentifier: process.env.INTERMEDIARY_IDENTIFIER,
  mnemonic: process.env.NODE_MNEMONIC,
  nodeUrl: process.env.NODE_URL,
  postgres: {
    database: process.env.POSTGRES_DATABASE!,
    host: process.env.POSTGRES_HOST!,
    password: process.env.POSTGRES_PASSWORD!,
    port: parseInt(process.env.POSTGRES_PORT!, 10),
    type: "postgres" as any, // supposed to be an "expo" type, not a string? wtf mate?
    username: process.env.POSTGRES_USER!,
  },
  username: process.env.USERNAME || "unknown",
};
