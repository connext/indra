import * as connext from "@connext/client";
import {
  DepositParameters,
  LinkedTransferParameters,
  ResolveLinkedTransferParameters,
  WithdrawParameters,
} from "@connext/types";
import { NODE_EVENTS } from "@counterfactual/node";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { formatEther, parseEther } from "ethers/utils";

import { registerClientListeners } from "./bot";
import { config } from "./config";
import { store } from "./store";
import { logEthFreeBalance } from "./utils";

process.on("warning", (e: any): any => {
  console.warn(e);
  process.exit(1);
});

process.on("unhandledRejection", (e: any): any => {
  console.error(e);
  process.exit(1);
});

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

export function getFreeBalanceAddress(): string {
  return client.freeBalanceAddress;
}

export function getConnextClient(): connext.ConnextInternal {
  return client;
}

async function run(): Promise<void> {
  const assetId = config.assetId ? config.assetId.toLowerCase() : AddressZero;
  setAssetId(assetId);
  await getOrCreateChannel(assetId);

  const apps = await client.getAppInstances();
  console.log("apps: ", apps);
  if (config.deposit) {
    const depositParams: DepositParameters = {
      amount: parseEther(config.deposit).toString(),
    };
    if (assetId !== AddressZero) {
      depositParams.assetId = assetId;
    }
    console.log(`Attempting to deposit ${depositParams.amount} with assetId ${assetId}...`);
    await client.deposit(depositParams);
    console.log(`Successfully deposited!`);
    process.exit(0);
  }

  if (config.requestCollateral) {
    console.log(`Requesting collateral...`);
    await client.requestCollateral(assetId);
    console.log(`Successfully received collateral!`);
    process.exit(0);
  }

  if (config.transfer) {
    console.log(`Attempting to transfer ${config.transfer} with assetId ${assetId}...`);
    await client.transfer({
      amount: parseEther(config.transfer).toString(),
      assetId,
      recipient: config.counterparty,
    });
    console.log(`Successfully transferred!`);
    process.exit(0);
  }

  if (config.swap) {
    const tokenAddress = (await client.config()).contractAddresses.Token;
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    console.log(
      `Attempting to swap ${config.swap} of eth for ${assetId} at rate ${swapRate.toString()}...`,
    );
    await client.swap({
      amount: parseEther(config.swap).toString(),
      fromAssetId: AddressZero,
      swapRate: swapRate.toString(),
      toAssetId: assetId,
    });
    console.log(`Successfully swapped!`);
    process.exit(0);
  }

  if (config.linked && !config.paymentId) {
    const linkedParams: LinkedTransferParameters = {
      amount: parseEther(config.linked).toString(),
      assetId,
      conditionType: "LINKED_TRANSFER",
    };
    console.log(`Attempting to create link with ${config.linked} of ${assetId}...`);
    const res = await client.conditionalTransfer(linkedParams);
    console.log(`Successfully created! Linked response: ${JSON.stringify(res, null, 2)}`);
    process.exit(0);
  }

  if (config.paymentId) {
    if (!config.preImage) {
      throw new Error(`Cannot redeem a linked payment without an associated preImage.`);
    }
    if (!config.linked) {
      throw new Error(`Cannot redeem a linked payment without an associated amount`);
    }
    const resolveParams: ResolveLinkedTransferParameters = {
      amount: parseEther(config.linked).toString(),
      assetId,
      conditionType: "LINKED_TRANSFER",
      paymentId: config.paymentId,
      preImage: config.preImage,
    };
    console.log(
      `Attempting to redeem link with parameters: ${JSON.stringify(resolveParams, null, 2)}...`,
    );
    const res = await client.resolveCondition(resolveParams);
    console.log(`Successfully redeemed! Resolve response: ${JSON.stringify(res, null, 2)}`);
    process.exit(0);
  }

  if (config.withdraw) {
    const withdrawParams: WithdrawParameters = {
      amount: parseEther(config.withdraw).toString(),
    };
    if (assetId !== AddressZero) {
      withdrawParams.assetId = assetId;
    }
    if (config.recipient) {
      withdrawParams.recipient = config.recipient;
    }
    const provider = new JsonRpcProvider(config.ethProviderUrl);
    const preWithdrawBal = await provider.getBalance(config.recipient || client.freeBalanceAddress);
    console.log(`Found prewithdrawal balance of ${formatEther(preWithdrawBal)}`);

    client.on(NODE_EVENTS.WITHDRAWAL_CONFIRMED, async (data: any) => {
      console.log(`Caught withdraw confirmed event, data: ${JSON.stringify(data, null, 2)}`);
      const postWithdrawBal = await provider.getBalance(
        config.recipient || client.freeBalanceAddress,
      );
      console.log(`Found postwithdrawal balance of ${formatEther(postWithdrawBal)}`);
    });

    client.on(NODE_EVENTS.WITHDRAWAL_FAILED, async (data: any) => {
      console.log(`Withdrawal failed with data: ${JSON.stringify(data, null, 2)}`);
    });

    console.log(
      `Attempting to withdraw ${withdrawParams.amount} with assetId ` +
        `${withdrawParams.assetId} to address ${withdrawParams.recipient}...`,
    );
    await client.withdraw(withdrawParams);
    console.log(`Successfully withdrawn!`);
    // process.exit(0);
  }

  if (config.uninstall) {
    console.log(`Attempting to uninstall app ${config.uninstall}`);
    await client.uninstallApp(config.uninstall);
    console.log(`Successfully uninstalled ${config.uninstall}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
    process.exit(0);
  }

  if (config.uninstallVirtual) {
    console.log(`Attempting to uninstall virtual app ${config.uninstallVirtual}`);
    await client.uninstallVirtualApp(config.uninstallVirtual);
    console.log(`Successfully uninstalled ${config.uninstallVirtual}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
    process.exit(0);
  }

  logEthFreeBalance(assetId, await client.getFreeBalance(assetId));
  console.log(`Ready to receive transfers at ${client.opts.cfModule.publicIdentifier}`);
}

async function getOrCreateChannel(assetId?: string): Promise<void> {
  const connextOpts = {
    ethProviderUrl: config.ethProviderUrl,
    logLevel: config.logLevel,
    mnemonic: config.mnemonic,
    nodeUrl: config.nodeUrl,
    store,
  };

  console.log("Using client options:");
  console.log("     - mnemonic:", connextOpts.mnemonic);
  console.log("     - ethProviderUrl:", connextOpts.ethProviderUrl);
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
    console.log(`Adding payment profile for ${assetId}`);
    await client.addPaymentProfile({
      amountToCollateralize: parseEther("10").toString(),
      minimumMaintainedCollateral: parseEther("5").toString(),
      tokenAddress: assetId.toLowerCase(),
    });
  }
  registerClientListeners();
}

run();
