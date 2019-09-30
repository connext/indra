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
  .option("-a, --asset-id <address>", "Asset ID (token address) to take action with")
  .option("-c, --counterparty <id>", "Counterparty public identifier")
  .option("-d, --deposit <amount>", "Deposit amount in Ether units")
  .option("-e, --pre-image <preImage>", "Redeem a linked payment with preImage")
  .option("-g, --get-free-balance", "Print bot's free balance and exit")
  .option("-h, --preImage <preImage>", "Create linked payment with preimage")
  .option("-i, --identifier <id>", "Bot identifier")
  .option("-l, --linked <amount>", "Create linked payment")
  .option("-m, --redeem-linked-to <amount>", "Redeem linked payment to recipient")
  .option("-n, --linked-to <amount>", "Create linked payment only unlockable by the recipient")
  .option("-o, --open", "Leave bot open instead of quitting")
  .option("-p, --payment-id <paymentId>", "Linked payment paymentId")
  .option("-q, --request-collateral", "Request channel collateral from the node")
  .option("-r, --recipient <address>", "Withdrawal recipient address")
  .option("-s, --swap <amount>", "Swap amount in Ether units")
  .option("-t, --transfer <amount>", "Transfer amount in Ether units")
  .option("-u, --uninstall <appDefinitionId>", "Uninstall app")
  .option("-v, --uninstall-virtual <appDefinitionId>", "Uninstall virtual app")
  .option("-w, --withdraw <amount>", "Withdrawal amount in Ether units")
  .option("-x, --debug", "output extra debugging")
  .option("-y, --redeem <amount>", "Redeem a linked payment")
  .option("-z, --restore <mnemonic>", "Restore state from mnemonic using node's records");

program.parse(process.argv);

export const config: any = {
  dbFile: process.env.DB_FILENAME!,
  ethProviderUrl: process.env.ETH_RPC_URL!,
  logLevel: 2,
  mnemonic: process.env.MNEMONIC!,
  nodeUrl: process.env.NODE_URL!,
  ...program,
};
