import * as connext from "@connext/client";
import {
  DepositParameters,
  LinkedTransferParameters,
  ResolveLinkedTransferParameters,
  WithdrawParameters,
} from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import { registerClientListeners } from "./bot";
import { config } from "./config";
import { store } from "./store";

process.on(
  "warning",
  (e: any): any => {
    console.warn(e);
    process.exit(1);
  },
);

process.on(
  "unhandledRejection",
  (e: any): any => {
    console.error(e);
    process.exit(1);
  },
);

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
  setAssetId(config.assetId);
  await getOrCreateChannel(config.assetId);
  if (config.assetId) {
    await client.subscribeToSwapRates(AddressZero, config.assetId, (msg: any) => {
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
  if (config.deposit) {
    const depositParams: DepositParameters = {
      amount: parseEther(config.deposit).toString(),
    };
    if (config.assetId) {
      depositParams.assetId = config.assetId;
    }
    console.log(`Attempting to deposit ${depositParams.amount} with assetId ${config.assetId}...`);
    await client.deposit(depositParams);
    console.log(`Successfully deposited!`);
    process.exit(0);
  }

  if (config.requestCollateral) {
    console.log(`Requesting collateral...`);
    await client.requestCollateral(config.assetId || AddressZero);
    console.log(`Successfully received collateral!`);
  }

  if (config.transfer) {
    console.log(`Attempting to transfer ${config.transfer} with assetId ${config.assetId}...`);
    await client.transfer({
      amount: parseEther(config.transfer).toString(),
      assetId: config.assetId || AddressZero,
      recipient: config.counterparty,
    });
    console.log(`Successfully transferred!`);
    process.exit(0);
  }

  if (config.swap) {
    const tokenAddress = (await client.config()).contractAddresses.Token;
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    console.log(
      `Attempting to swap ${config.swap} of eth for ${
        config.assetId
      } at rate ${swapRate.toString()}...`,
    );
    await client.swap({
      amount: parseEther(config.swap).toString(),
      fromAssetId: AddressZero,
      swapRate: swapRate.toString(),
      toAssetId: config.assetId,
    });
    console.log(`Successfully swapped!`);
    process.exit(0);
  }

  if (config.linked && !config.paymentId) {
    const linkedParams: LinkedTransferParameters = {
      amount: parseEther(config.linked).toString(),
      assetId: config.assetId || AddressZero,
      conditionType: "LINKED_TRANSFER",
    };
    console.log(`Attempting to create link with ${config.linked} of ${linkedParams.assetId}...`);
    const res = await client.conditionalTransfer(linkedParams);
    console.log(`Successfully created! Linked response: ${JSON.stringify(res, null, 2)}`);
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
      assetId: config.assetId || AddressZero,
      conditionType: "LINKED_TRANSFER",
      paymentId: config.paymentId,
      preImage: config.preImage,
    };
    console.log(
      `Attempting to redeem link with parameters: ${JSON.stringify(resolveParams, null, 2)}...`,
    );
    const res = await client.resolveCondition(resolveParams);
    console.log(`Successfully redeemed! Resolve response: ${JSON.stringify(res, null, 2)}`);
  }

  if (config.withdraw) {
    const withdrawParams: WithdrawParameters = {
      amount: parseEther(config.withdraw).toString(),
    };
    if (config.assetId) {
      withdrawParams.assetId = config.assetId;
    }
    if (config.recipient) {
      withdrawParams.recipient = config.recipient;
    }
    console.log(
      `Attempting to withdraw ${withdrawParams.amount} with assetId ` +
        `${withdrawParams.assetId} to address ${withdrawParams.recipient}...`,
    );
    await client.withdraw(withdrawParams);
    console.log(`Successfully withdrawn!`);
    process.exit(0);
  }

  if (config.uninstall) {
    console.log(`Attempting to uninstall app ${config.uninstall}`);
    await client.uninstallApp(config.uninstall);
    console.log(`Successfully uninstalled ${config.uninstall}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
  }

  if (config.uninstallVirtual) {
    console.log(`Attempting to uninstall virtual app ${config.uninstallVirtual}`);
    await client.uninstallVirtualApp(config.uninstallVirtual);
    console.log(`Successfully uninstalled ${config.uninstallVirtual}`);
    console.log(`Installed apps: ${await client.getAppInstances()}`);
  }

  client.logEthFreeBalance(AddressZero, await client.getFreeBalance());
  if (config.assetId) {
    client.logEthFreeBalance(config.assetId, await client.getFreeBalance(config.assetId));
  }
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
    await client.addPaymentProfile({
      amountToCollateralize: parseEther("10").toString(),
      minimumMaintainedCollateral: parseEther("5").toString(),
      tokenAddress: assetId,
    });
  }
  registerClientListeners();
}

run();
