import { abrv, ChannelSigner, ColorfulLogger, getRandomPrivateKey } from "@connext/utils";
import { constants, providers, utils, Wallet } from "ethers";
import { Argv } from "yargs";

import { env } from "./env";
import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
import { Agent } from "./agents/agent";
import { EventNames, ConditionalTransferTypes } from "@connext/types";

const { AddressZero, Two } = constants;
const { formatEther, parseEther } = utils;

export const command = {
  command: "e2e",
  describe: "Run a quick e2e test",
  builder: (yargs: Argv) => {
    return yargs
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 1,
      })
      .option("token-address", {
        describe: "Asset id for payments",
        type: "string",
        default: AddressZero,
      })
      .option("chain-id", {
        describe: "Chain ID to test",
        type: "number",
        default: 1337,
      })
      .option("funder-mnemonic", {
        describe: "Mnemonic for the account that can give funds to the bots",
        type: "string",
        default: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
      });
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const ethProvider = new providers.JsonRpcProvider(env.ethProviderUrl);
    const sugarDaddy = Wallet.fromMnemonic(argv.funderMnemonic).connect(ethProvider);
    const startEthBalance = await sugarDaddy.getBalance();

    // sugarDaddy grants each bot some funds to start with
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.001"); // Note: max amount in signer address is 1 eth

    // Abort if sugarDaddy doesn't have enough ETH to fund all the bots
    if (startEthBalance.lt(DEPOSIT_AMT.mul(2))) {
      throw new Error(
        `Account ${sugarDaddy.address} has insufficient ETH. ${DEPOSIT_AMT.mul(
          2,
        )} required, got ${formatEther(startEthBalance)}`,
      );
    }

    let privateKey = getRandomPrivateKey();

    // SETUP SENDER + FUND

    const sender = await connect({
      ...env,
      signer: new ChannelSigner(privateKey, env.ethProviderUrl),
      loggerService: new ColorfulLogger("Sender", argv.logLevel, true),
      store: getMemoryStore(),
    });

    const bot = new Wallet(privateKey, ethProvider);
    if ((await bot.getBalance()).lt(DEPOSIT_AMT.div(Two))) {
      console.log(`Sending ${DEPOSIT_AMT} ETH to sender: ${abrv(sender.signerAddress)}`);
      const tx = await sugarDaddy.sendTransaction({
        to: sender.signerAddress,
        value: DEPOSIT_AMT,
      });
      console.log(`Tx sent: ${tx.hash}`);
      await tx.wait();
      console.log(`Tx mined on ${tx.chainId}`);
    }

    console.log(`Sender:
      publicIdentifier: ${sender.publicIdentifier}
      signer: ${sender.signerAddress}
      nodeIdentifier: ${sender.nodeIdentifier}
      nodeSignerAddress: ${sender.nodeSignerAddress}`);

    const senderAgent = new Agent(
      new ColorfulLogger("SenderAgent", argv.logLevel, true),
      sender,
      privateKey,
      false,
    );

    console.log("Sender starting up.");
    await senderAgent.start();
    console.log("Sender started.");

    // SETUP RECEIVER

    privateKey = getRandomPrivateKey();

    const receiver = await connect({
      ...env,
      signer: new ChannelSigner(privateKey, env.ethProviderUrl),
      loggerService: new ColorfulLogger("Receiver", argv.logLevel, true),
      store: getMemoryStore(),
    });

    console.log(`Receiver:
      publicIdentifier: ${receiver.publicIdentifier}
      signer: ${receiver.signerAddress}
      nodeIdentifier: ${receiver.nodeIdentifier}
      nodeSignerAddress: ${receiver.nodeSignerAddress}`);

    const receiverAgent = new Agent(
      new ColorfulLogger("ReceiverAgent", argv.logLevel, true),
      receiver,
      privateKey,
      false,
    );

    console.log("Receiver starting up.");
    await receiverAgent.start();
    console.log("Receiver started.");

    // SENDER DEPOSIT
    console.log(`Sender depositing ETH (onchain balance: ${formatEther(await bot.getBalance())})`);
    await senderAgent.depositIfNeeded(TRANSFER_AMT, TRANSFER_AMT);
    console.log(`Deposit complete`);

    let preTransferBalance = await sender.getFreeBalance();
    console.log(`Pre-transfer balance sender: ${preTransferBalance[sender.signerAddress]}`);

    preTransferBalance = await receiver.getFreeBalance();
    console.log(`Pre-transfer balance receiver: ${preTransferBalance[receiver.signerAddress]}`);

    // SENDER TRANSFER TO RECEIVER
    console.log(`Starting transfer`);
    const ONE_MINUTE = 60_000;
    const receiverUnlocked = receiver.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      ONE_MINUTE,
    );
    const senderUnlocked = sender.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      ONE_MINUTE,
    );
    await senderAgent.pay(
      receiver.publicIdentifier,
      receiver.signerAddress,
      TRANSFER_AMT,
      undefined,
      undefined,
      ConditionalTransferTypes.LinkedTransfer,
      ONE_MINUTE,
    );
    await receiverUnlocked;
    await senderUnlocked;
    console.log(`Transfer complete`);

    const postTransferBalanceSender = await sender.getFreeBalance();
    console.log(`Post-transfer balance sender: ${postTransferBalanceSender[sender.signerAddress]}`);

    const postTransferBalanceReceiver = await receiver.getFreeBalance();
    console.log(
      `Post-transfer balance receiver: ${postTransferBalanceReceiver[receiver.signerAddress]}`,
    );

    // WITHDRAW
    console.log(`Starting withdrawal`);
    await receiver.withdraw({
      amount: postTransferBalanceReceiver[receiver.signerAddress],
      recipient: receiver.nodeSignerAddress,
    });
    console.log(`Withdrawal complete`);

    const postWithdrawalBalanceReceiver = await receiver.getFreeBalance();
    console.log(
      `Post-Withdrawal balance receiver: ${postWithdrawalBalanceReceiver[receiver.signerAddress]}`,
    );

    process.exit(0);
  },
};
