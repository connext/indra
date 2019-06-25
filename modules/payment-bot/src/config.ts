import { confirmPostgresConfigurationEnvVars } from "@counterfactual/postgresql-node-connector";
import { NetworkContext } from "@counterfactual/types";
import "dotenv";

confirmPostgresConfigurationEnvVars();

if (!process.env.NATS_URL || !process.env.NATS_URL.startsWith("nats://")) {
  throw Error(`No valid nats url specified in env: ${process.env.NATS_URL} Exiting.`);
}

if (!process.env.NODE_URL) {
  throw Error("No node url specified in env. Exiting.");
}

const args = process.argv.slice(2);
const ethNetwork = process.env.ETH_NETWORK || "ganache";

export const config = {
  action: args[0] || "none",
  args: args.length > 1 ? args.slice(1) : [],
  delaySeconds: process.env.DELAY_SECONDS ? Number(process.env.DELAY_SECONDS) : 5,
  ethNetwork,
  ethRpcUrl: process.env.ETH_RPC_URL || `https://${ethNetwork}.infura.io`,
  getEthAddresses: (chainId: string | number): NetworkContext => {
    const ethAddressBook = JSON.parse(process.env.ETH_ADDRESSES || "{}");
    const ethAddresses = {};
    Object.keys(ethAddressBook).map((contract: string): void => {
      ethAddresses[contract] = ethAddressBook[contract].networks[chainId.toString()].address;
    });
    return ethAddresses as any;
  },
  intermediaryIdentifier: process.env.INTERMEDIARY_IDENTIFIER,
  mnemonic: process.env.NODE_MNEMONIC,
  natsUrl: process.env.NATS_URL || "nats://localhost:4222",
  nodeUrl: process.env.NODE_URL || "http://localhost:8080",
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
