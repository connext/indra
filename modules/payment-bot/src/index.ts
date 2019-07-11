import * as connext from "@connext/client";
import { DepositParameters, WithdrawParameters } from "@connext/types";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import commander from "commander";
import { ethers } from "ethers";
import { AddressZero } from "ethers/constants";

import { registerClientListeners } from "./bot";
import { config } from "./config";

const program = new commander.Command();
program.version("0.0.1");

program
  .option("-x, --debug", "output extra debugging")
  .option("-d, --deposit <amount>", "Deposit amount in Ether units")
  .option(
    "-a, --asset-id <address>",
    "Asset ID/Token Address of deposited, withdrawn, or transferred asset",
  )
  .option("-t, --transfer <amount>", "Transfer amount in Ether units")
  .option("-c, --counterparty <id>", "Counterparty public identifier")
  .option("-i, --identifier <id>", "Bot identifier")
  .option("-w, --withdraw <amount>", "Withdrawal amount in Ether units")
  .option("-r, --recipient <address>", "Withdrawal recipient address");

program.parse(process.argv);

process.on("warning", (e: any): any => console.warn(e.stack));

const pgServiceFactory: PostgresServiceFactory = new PostgresServiceFactory(config.postgres);

let client: connext.ConnextInternal;

// TODO: fix for multiple deposited assets
let assetId: string;

export function getAssetId(): string {
  return assetId;
}

export function setAssetId(aid: string): void {
  assetId = aid;
}

export function getMultisigAddress(): string {
  return client.opts.multisigAddress;
}

export function getWalletAddress(): string {
  return client.wallet.address;
}

export function getConnextClient(): connext.ConnextInternal {
  return client;
}

async function run(): Promise<void> {
  await getOrCreateChannel();
  if (program.assetId) {
    assetId = program.assetId;
  }

  if (program.deposit) {
    const depositParams: DepositParameters = {
      amount: ethers.utils.parseEther(program.deposit).toString(),
    };
    if (program.assetId) {
      depositParams.assetId = program.assetId;
    }
    console.log(`Attempting to deposit ${depositParams.amount} with assetId ${program.assetId}...`);
    // try {
      await client.deposit(depositParams);
      console.log(`Successfully deposited!`);
    // } catch (e) {
    //   console.log("Failed to deposit:", JSON.stringify(e, null, 2));
    //   process.exit(1);
    // }
  }

  if (program.transfer) {
    // try {
      await client.transfer({
        amount: ethers.utils.parseEther(program.transfer).toString(),
        recipient: program.counterparty,
      });
    // } catch (e) {
    //   console.log("Failed to transfer:", JSON.stringify(e, null, 2));
    //   process.exit(1);
    // }
  }

  if (program.withdraw) {
    const withdrawParams: WithdrawParameters = {
      amount: ethers.utils.parseEther(program.withdrawal).toString(),
    };
    if (program.assetId) {
      withdrawParams.assetId = program.assetId;
    }
    if (program.recipient) {
      withdrawParams.recipient = program.recipient;
    }
    console.log(
      `Attempting to deposit ${withdrawParams.amount} with assetId ` +
        `${withdrawParams.assetId} to address ${withdrawParams.recipient}...`,
    );
    // try {
      await client.withdraw(withdrawParams);
    // } catch (e) {
    //   console.log("Failed to withdraw:", JSON.stringify(e, null, 2));
    //   process.exit(1);
    // }
  }

  client.logEthFreeBalance(AddressZero, await client.getFreeBalance());
  if (assetId) {
    client.logEthFreeBalance(assetId, await client.getFreeBalance(assetId));
  }
  console.log(`Ready to receive transfers at ${client.opts.cfModule.publicIdentifier}`);
}

async function getOrCreateChannel(): Promise<void> {
  await pgServiceFactory.connectDb();

  const connextOpts = {
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    rpcProviderUrl: config.ethRpcUrl,
    store: pgServiceFactory.createStoreService(config.username),
  };

  console.log("Using client options:");
  console.log("     - mnemonic:", connextOpts.mnemonic);
  console.log("     - rpcProviderUrl:", connextOpts.rpcProviderUrl);
  console.log("     - nodeUrl:", connextOpts.nodeUrl);

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
}

run();
