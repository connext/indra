import * as connext from "@connext/client";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import commander from "commander";

import { config } from "./config";
import { ethers } from "ethers";
import { registerClientListeners } from "./bot";

const program = new commander.Command();
program.version("0.0.1");

program
  .option("-x, --debug", "output extra debugging")
  .option("-d, --deposit <amount>", "Deposit amount in Ether units")
  .option("-a, --asset-id", "Asset ID/Token Address of deposited asset")
  .option("-m, --mode <mode>", "Mode must be 'sender' or 'receiver'");

program.parse(process.argv);

process.on("warning", (e: any): any => console.warn(e.stack));

const pgServiceFactory: PostgresServiceFactory = new PostgresServiceFactory(config.postgres);

let client: connext.ConnextInternal;

export function getMultisigAddress(): string {
  return client.opts.multisigAddress;
}

export function getWalletAddress(): string {
  return client.wallet.address;
}

export function getConnextClient(): connext.ConnextInternal {
  return client;
}

if (program.debug) console.log(program.opts());

if (program.deposit) {
  console.log("program.deposit: ", program.deposit);
}

async function run() {
  await getOrCreateChannel();
  
  console.log(`action: ${config.action}, args: ${config.args}`);
  if (program.deposit) {
    const depositParams = {
      amount: ethers.utils.parseEther(program.deposit).toString(),
    };
    console.log(`Attempting to deposit ${depositParams.amount}...`);
    await client.deposit(depositParams);
    console.log(`Successfully deposited!`);
  }
}

async function getOrCreateChannel() {
  await pgServiceFactory.connectDb();

  const connextOpts = {
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    rpcProviderUrl: config.ethRpcUrl,
    store: pgServiceFactory.createStoreService(config.username),
  };

  console.log("Using client options:");
  console.log("     - mnemonic:", config.mnemonic);
  console.log("     - rpcProviderUrl:", config.ethRpcUrl);
  console.log("     - natsUrl:", config.natsUrl);
  console.log("     - nodeUrl:", config.nodeUrl);

  console.log("Creating connext");
  client = await connext.connect(connextOpts);
  console.log("Client created successfully!");

  const connextConfig = await client.config();
  console.log("connextConfig:", connextConfig);

  console.log("Public Identifier", client.publicIdentifier);
  console.log("Account multisig address:", client.opts.multisigAddress);

  const channelAvailable = async (): Promise<boolean> => (await client.getChannel()).available;
  const interval = 3;
  while (!(await channelAvailable())) {
    console.info(`Waiting ${interval} more seconds for channel to be available`);
    await new Promise((res: any): any => setTimeout(() => res(), interval * 1000));
  }

  registerClientListeners();

  client.logEthFreeBalance(await client.getFreeBalance());
}
