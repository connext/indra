import commander from "commander";
import "dotenv";

if (!process.env.NODE_URL) {
  throw Error("No node url specified in env. Exiting.");
}

if (!process.env.ETH_RPC_URL) {
  throw Error("No eth rpc url specified in env. Exiting.");
}

if (!process.env.MNEMONIC) {
  throw Error("No mnemonic specified in env. Exiting.");
}

const program = new commander.Command();
program.version("0.0.1");

program
  .option("-x, --debug", "output extra debugging")
  .option("-d, --deposit <amount>", "Deposit amount in Ether units")
  .option(
    "-a, --asset-id <address>",
    "Asset ID/Token Address of deposited, withdrawn, swapped, or transferred asset",
  )
  .option("-t, --transfer <amount>", "Transfer amount in Ether units")
  .option("-c, --counterparty <id>", "Counterparty public identifier")
  .option("-i, --identifier <id>", "Bot identifier")
  .option("-w, --withdraw <amount>", "Withdrawal amount in Ether units")
  .option("-r, --recipient <address>", "Withdrawal recipient address")
  .option("-s, --swap <amount>", "Swap amount in Ether units")
  .option("-q, --request-collateral", "Request channel collateral from the node");

program.parse(process.argv);

export const config: any = {
  ethProviderUrl: process.env.ETH_RPC_URL!,
  mnemonic: process.env.MNEMONIC!,
  nodeUrl: process.env.NODE_URL!,
  postgres: {
    database: process.env.POSTGRES_DATABASE!,
    host: process.env.POSTGRES_HOST!,
    password: process.env.POSTGRES_PASSWORD!,
    port: parseInt(process.env.POSTGRES_PORT!, 10),
    type: "postgres" as any, // supposed to be an "expo" type, not a string? wtf mate?
    username: process.env.POSTGRES_USER!,
  },
  username: process.env.USERNAME || "unknown",
  ...program,
};
