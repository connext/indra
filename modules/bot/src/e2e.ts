import { artifacts } from "@connext/contracts";
import {
  abrv,
  toBN,
  ChannelSigner,
  ColorfulLogger,
  abbreviate,
  getRandomPrivateKey,
} from "@connext/utils";
import { constants, Contract, providers, utils, Wallet, BigNumber } from "ethers";
import { Argv } from "yargs";

import { startBot } from "./agents/bot";
import { env } from "./env";
import { internalBotRegistry } from "./helpers/agentIndex";
import { connect } from "@connext/client";
import { getFileStore, getMemoryStore } from "@connext/store";
import { Agent } from "./agents/agent";
import { EventNames } from "@connext/types";

const { AddressZero, HashZero, Two } = constants;
const { formatEther, sha256, parseEther } = utils;

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
    const TRANSFER_AMT = parseEther("0.001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth

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

    let signer = new ChannelSigner(privateKey, env.ethProviderUrl);
    const sender = await connect({
      ...env,
      signer,
      loggerService: new ColorfulLogger("Sender", argv.logLevel, true),
      store: getMemoryStore(),
    });

    const bot = new Wallet(privateKey, ethProvider);
    if ((await bot.getBalance()).lt(DEPOSIT_AMT.div(Two))) {
      console.log(`Sending ${DEPOSIT_AMT} ETH to sender: ${abrv(bot.address)}`);
      await sugarDaddy.sendTransaction({
        to: bot.address,
        value: DEPOSIT_AMT,
      });
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

    signer = new ChannelSigner(privateKey, env.ethProviderUrl);
    const receiver = await connect({
      ...env,
      signer,
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
    console.log(`Sender depositing`);
    await senderAgent.depositIfNeeded(TRANSFER_AMT, TRANSFER_AMT);
    console.log(`Deposit complete`);

    let preTransferBalance = await sender.getFreeBalance();
    console.log(`Pre-transfer balance sender: ${preTransferBalance[sender.signerAddress]}`);

    preTransferBalance = await receiver.getFreeBalance();
    console.log(`Pre-transfer balance receiver: ${preTransferBalance[receiver.signerAddress]}`);

    // SENDER TRANSFER TO RECEIVER
    console.log(`Starting transfer`);
    const receiverUnlocked = receiver.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      60_000,
    );
    const senderUnlocked = sender.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 60_000);
    await senderAgent.pay(receiver.publicIdentifier, receiver.signerAddress, TRANSFER_AMT);
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
