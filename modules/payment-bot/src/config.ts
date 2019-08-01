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

if (!process.env.DB_FILENAME) {
  throw Error("No dbFile specified in env. Exiting.");
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
  .option("-q, --request-collateral", "Request channel collateral from the node")
  .option("-u, --uninstall <appDefinitionId>", "Uninstall app")
  .option("-v, --uninstall-virtual <appDefinitionId>", "Uninstall virtual app")
  .option("-l, --linked <amount>", "Create linked payment")
  .option("-p, --payment-id <paymentId>", "Redeem a linked payment with paymentId")
  .option("-e, --pre-image <preImage>", "Redeem a linked payment with preImage");

program.parse(process.argv);

export const config: any = {
  dbFile: process.env.DB_FILENAME!,
  ethProviderUrl: process.env.ETH_RPC_URL!,
  logLevel: 3,
  mnemonic: process.env.MNEMONIC!,
  nodeUrl: process.env.NODE_URL!,
  ...program,
};
