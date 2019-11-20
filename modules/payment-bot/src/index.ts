import {
  CFCoreTypes,
  DepositParameters,
  LinkedTransferParameters,
  LinkedTransferToRecipientParameters,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferToRecipientParameters,
  WithdrawParameters,
} from "@connext/types";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { formatEther, hexlify, parseEther, randomBytes } from "ethers/utils";

import { getOrCreateChannel } from "./channel";
import { config } from "./config";
import { checkForLinkedFields, logEthFreeBalance, replaceBN } from "./utils";

process.on("warning", (e: any): any => {
  console.warn(e);
  process.exit(1);
});

process.on("unhandledRejection", (e: any): any => {
  console.error(e);
  process.exit(1);
});

////////////////////////////////////////
// Begin executing w/in an async wrapper function

(async (): Promise<void> => {
  const client = await getOrCreateChannel();
  const assetId = config.useToken ? client.config.contractAddresses.Token : AddressZero;

  const logEthAndAssetFreeBalance = async (): Promise<void> => {
    logEthFreeBalance(AddressZero, await client.getFreeBalance());
    logEthFreeBalance(
      client.config.contractAddresses.Token,
      await client.getFreeBalance(client.config.contractAddresses.Token),
    );
  };

  if (config.getFreeBalance) {
    await logEthAndAssetFreeBalance();
  }

  if (config.deposit) {
    const depositParams: DepositParameters = {
      amount: parseEther(config.deposit).toString(),
    };
    if (assetId !== AddressZero) {
      depositParams.assetId = assetId;
    }
    console.log(`Depositing ${config.deposit} of asset ${assetId}`);
    await client.deposit(depositParams);
    console.log(`Successfully deposited!`);
    await logEthAndAssetFreeBalance();
  }

  if (config.requestCollateral) {
    console.log(`Requesting collateral...`);
    await client.requestCollateral(assetId);
    console.log(`Successfully received collateral!`);
    await logEthAndAssetFreeBalance();
  }

  if (config.transfer) {
    console.log(`Transferring ${config.transfer} of asset ${assetId} to ${config.counterparty}`);
    await client.transfer({
      amount: parseEther(config.transfer).toString(),
      assetId,
      recipient: config.counterparty,
    });
    console.log(`Successfully transferred!`);
    await logEthAndAssetFreeBalance();
  }

  if (config.swap) {
    const tokenAddress = client.config.contractAddresses.Token;
    const swapRate = await client.getLatestSwapRate(AddressZero, tokenAddress);
    console.log(`Swapping ${config.swap} eth for ${assetId} at rate ${swapRate.toString()}`);
    await client.swap({
      amount: parseEther(config.swap).toString(),
      fromAssetId: AddressZero,
      swapRate: swapRate.toString(),
      toAssetId: assetId,
    });
    console.log(`Successfully swapped!`);
    await logEthAndAssetFreeBalance();
  }

  if (config.linked) {
    let { preImage, paymentId } = config;
    if (!preImage) {
      preImage = hexlify(randomBytes(32));
    }
    if (!paymentId) {
      paymentId = hexlify(randomBytes(32));
    }
    const linkedParams: LinkedTransferParameters = {
      amount: parseEther(config.linked).toString(),
      assetId,
      conditionType: "LINKED_TRANSFER",
      paymentId,
      preImage,
    };
    console.log(`Creating link payment for ${config.linked} of asset ${assetId}`);
    const res = await client.conditionalTransfer(linkedParams);
    console.log(`Successfully created! Linked response: ${JSON.stringify(res, replaceBN, 2)}`);
    await logEthAndAssetFreeBalance();
  }

  if (config.linkedTo) {
    let { preImage, paymentId } = config;
    if (!preImage) {
      preImage = hexlify(randomBytes(32));
    }
    if (!paymentId) {
      paymentId = hexlify(randomBytes(32));
    }
    const linkedParams: LinkedTransferToRecipientParameters = {
      amount: parseEther(config.linkedTo).toString(),
      assetId,
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      paymentId,
      preImage,
      recipient: config.counterparty,
    };
    console.log(`Creating link payment for ${config.linkedTo} of asset ${assetId}`);
    const res = await client.conditionalTransfer(linkedParams);
    console.log(`Successfully created! Linked response: ${JSON.stringify(res, replaceBN, 2)}`);
  }

  if (config.redeem) {
    checkForLinkedFields(config);
    const resolveParams: ResolveLinkedTransferParameters = {
      conditionType: "LINKED_TRANSFER",
      paymentId: config.paymentId,
      preImage: config.preImage,
    };
    console.log(`Redeeming link with parameters: ${JSON.stringify(resolveParams, replaceBN, 2)}`);
    const res = await client.resolveCondition(resolveParams);
    console.log(`Successfully redeemed! Resolve response: ${JSON.stringify(res, replaceBN, 2)}`);
    await logEthAndAssetFreeBalance();
  }

  if (config.redeemLinkedTo) {
    checkForLinkedFields(config);
    const resolveParams: ResolveLinkedTransferToRecipientParameters = {
      conditionType: "LINKED_TRANSFER_TO_RECIPIENT",
      paymentId: config.paymentId,
      preImage: config.preImage,
    };
    console.log(`Redeeming link with parameters: ${JSON.stringify(resolveParams, replaceBN, 2)}`);
    const res = await client.resolveCondition(resolveParams);
    console.log(`Successfully redeemed! Resolve response: ${JSON.stringify(res, replaceBN, 2)}`);
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
    client.on(
      CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED,
      async (data: any): Promise<void> => {
        console.log(`Caught withdraw confirmed event, data: ${JSON.stringify(data, replaceBN, 2)}`);
        const postWithdrawBal = await provider.getBalance(
          config.recipient || client.freeBalanceAddress,
        );
        console.log(`Found postwithdrawal balance of ${formatEther(postWithdrawBal)}`);
        const diff = postWithdrawBal.sub(preWithdrawBal);
        if (!diff.eq(withdrawParams.amount)) {
          throw new Error(
            `Amount withdrawn !== postWithdrawBal (${postWithdrawBal.toString()}) - preWithdrawBal (${preWithdrawBal.toString()})`,
          );
        }
      },
    );
    client.on(
      CFCoreTypes.EventName.WITHDRAWAL_FAILED,
      async (data: any): Promise<void> => {
        throw new Error(`Withdrawal failed with data: ${JSON.stringify(data, replaceBN, 2)}`);
      },
    );
    console.log(
      `Attempting to withdraw ${withdrawParams.amount} with assetId ` +
        `${withdrawParams.assetId} to address ${withdrawParams.recipient}...`,
    );
    await client.withdraw(withdrawParams);
    console.log(`Successfully withdrawn!`);
    await logEthAndAssetFreeBalance();
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

  if (config.restore) {
    console.log(`Restoring states from the node: ${config.restore}`);
    await client.restoreState();
  }

  if (!config.open) {
    process.exit(0);
  }

  console.log(`Waiting to receive transfers at ${client.publicIdentifier}`);
})();
