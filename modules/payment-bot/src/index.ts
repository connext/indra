import * as connext from "@connext/client";
import { DepositParameters, WithdrawParameters } from "@connext/types";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import commander from "commander";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { registerClientListeners } from "./bot";
import { config } from "./config";

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
  .option("-v, --uninstall-virtual <appDefinitionId>", "Uninstall virtual app");

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

let latestSwapRate;

async function run(): Promise<void> {
  await getOrCreateChannel(program.assetId);
  if (program.assetId) {
    await client.subscribeToSwapRates(AddressZero, program.assetId, (msg: any) => {
      latestSwapRate = msg.data;
      console.log("latestSwapRate: ", latestSwapRate);
      client.opts.store.set([
        {
          key: `${msg.pattern}`,
          value: msg.data,
        },
      ]);
    });
  }

  const apps = await client.getAppInstances();
  console.log("apps: ", apps);
  if (program.deposit) {
    const depositParams: DepositParameters = {
      amount: parseEther(program.deposit).toString(),
    };
    if (program.assetId) {
      depositParams.assetId = program.assetId;
    }
    console.log(`Attempting to deposit ${depositParams.amount} with assetId ${program.assetId}...`);
    await client.deposit(depositParams);
    console.log(`Successfully deposited!`);
  }

  if (program.requestCollateral) {
    console.log(`Requesting collateral...`);
    await client.requestCollateral(program.assetId || AddressZero);
  }

  if (program.transfer) {
    console.log(`Attempting to transfer ${program.transfer} with assetId ${program.assetId}...`);
    await client.transfer({
      amount: parseEther(program.transfer).toString(),
      assetId: program.assetId || AddressZero,
      recipient: program.counterparty,
    });
    console.log(`Successfully transferred!`);
  }

  if (program.swap) {
    const tokenAddress = program.assetId;
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    console.log(
      `Attempting to swap ${program.swap} of eth for ${
        program.assetId
      } at rate ${swapRate.toString()}...`,
    );
    await client.swap({
      amount: parseEther(program.swap).toString(),
      fromAssetId: AddressZero,
      swapRate: swapRate.toString(),
      toAssetId: program.assetId,
    });
    console.log(`Successfully swapped!`);
  }

  if (program.withdraw) {
    const withdrawParams: WithdrawParameters = {
      amount: parseEther(program.withdraw).toString(),
    };
    if (program.assetId) {
      withdrawParams.assetId = program.assetId;
    }
    if (program.recipient) {
      withdrawParams.recipient = program.recipient;
    }
    console.log(
      `Attempting to withdraw ${withdrawParams.amount} with assetId ` +
        `${withdrawParams.assetId} to address ${withdrawParams.recipient}...`,
    );
    await client.withdraw(withdrawParams);
    console.log(`Successfully withdrawn!`);
  }

  if (program.uninstall) {
    console.log(`Attempting to uninstall app ${program.uninstall}`);
    await client.uninstallApp(program.uninstall);
    console.log(`Successfully uninstalled ${program.uninstall}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
  }

  if (program.uninstallVirtual) {
    console.log(`Attempting to uninstall virtual app ${program.uninstallVirtual}`);
    await client.uninstallVirtualApp(program.uninstallVirtual);
    console.log(`Successfully uninstalled ${program.uninstallVirtual}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
  }

  client.logEthFreeBalance(AddressZero, await client.getFreeBalance());
  if (program.assetId) {
    client.logEthFreeBalance(program.assetId, await client.getFreeBalance(program.assetId));
  }
  console.log(`Ready to receive transfers at ${client.opts.cfModule.publicIdentifier}`);
}

async function getOrCreateChannel(assetId?: string): Promise<void> {
  await pgServiceFactory.connectDb();

  const connextOpts = {
    ethProviderUrl: config.ethProviderUrl,
    logLevel: 3,
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    store: pgServiceFactory.createStoreService(config.username),
  };

  console.log("Using client options:");
  console.log("     - mnemonic:", connextOpts.mnemonic);
  console.log("     - rpcProviderUrl:", connextOpts.ethProviderUrl);
  console.log("     - nodeUrl:", connextOpts.nodeUrl);

  console.log("Creating connext");
  client = await connext.connect(connextOpts);
  console.log("Client created successfully!");

  const connextConfig = await client.config();
  console.log("connextConfig:", connextConfig);

  console.log("Public Identifier", client.publicIdentifier);
  console.log("Account multisig address:", client.opts.multisigAddress);
  console.log("User free balance address:", client.freeBalanceAddress);
  console.log(
    "Node free balance address:",
    connext.utils.freeBalanceAddressFromXpub(client.nodePublicIdentifier),
  );

  const channelAvailable = async (): Promise<boolean> => {
    const channel = await client.getChannel();
    return channel && channel.available;
  };
  const interval = 3;
  while (!(await channelAvailable())) {
    console.info(`Waiting ${interval} more seconds for channel to be available`);
    await new Promise((res: any): any => setTimeout(() => res(), interval * 1000));
  }

  await client.addPaymentProfile({
    amountToCollateralize: parseEther("0.1").toString(),
    minimumMaintainedCollateral: parseEther("0.01").toString(),
    tokenAddress: AddressZero,
  });

  if (assetId) {
    await client.addPaymentProfile({
      amountToCollateralize: parseEther("10").toString(),
      minimumMaintainedCollateral: parseEther("5").toString(),
      tokenAddress: assetId,
    });
  }
  registerClientListeners();
}

run();
