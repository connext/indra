import {
  abrv,
  ChannelSigner,
  ColorfulLogger,
  getEthProvider,
  getGasPrice,
  getRandomPrivateKey,
} from "@connext/utils";
import { constants, utils, Wallet, Contract, BigNumber } from "ethers";
import { Argv } from "yargs";

import { env } from "./env";
import { connect } from "@connext/client";
import { getMemoryStore } from "@connext/store";
import { Agent } from "./agents/agent";
import { EventNames, ConditionalTransferTypes } from "@connext/types";
import { getAddress } from "ethers/lib/utils";
import { Token } from "@connext/contracts";

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
    const ethProvider = getEthProvider(env.ethProviderUrl, argv.chainId);
    const sugarDaddy = Wallet.fromMnemonic(argv.funderMnemonic).connect(ethProvider);
    const assetId = getAddress(argv.tokenAddress);
    const startEthBalance = await sugarDaddy.getBalance();
    const getChainBalance = (addr: string) => {
      return assetId === AddressZero
        ? ethProvider.getBalance(addr)
        : new Contract(assetId, Token.abi, sugarDaddy).balanceOf(addr);
    };
    const sendChainBalance = (addr: string, amount: BigNumber) => {
      const gasPrice = getGasPrice(ethProvider, argv.chainId);
      return assetId === AddressZero
        ? sugarDaddy.sendTransaction({ to: addr, value: amount, gasPrice })
        : new Contract(assetId, Token.abi, sugarDaddy).transfer(addr, amount, { gasPrice });
    };
    const startingAssetBalance = await getChainBalance(sugarDaddy.address);

    // sugarDaddy grants each bot some funds to start with
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.001"); // Note: max amount in signer address is 1 eth

    if (startEthBalance.lt(TRANSFER_AMT)) {
      console.log(`Warning: account ${sugarDaddy.address} might not have sufficient eth for gas`);
    }

    // Abort if sugarDaddy doesn't have enough gas + asset to fund all the bots
    if (startingAssetBalance.lt(DEPOSIT_AMT.mul(2))) {
      throw new Error(
        `Account ${sugarDaddy.address} has insufficient ${
          assetId === AddressZero ? "ETH" : "ERC20"
        }. ${DEPOSIT_AMT.mul(2)} required, got ${formatEther(startingAssetBalance)}`,
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

    console.log(`Sender:
      multisig: ${sender.multisigAddress}
      publicIdentifier: ${sender.publicIdentifier}
      signer: ${sender.signerAddress}
      nodeIdentifier: ${sender.nodeIdentifier}
      nodeSignerAddress: ${sender.nodeSignerAddress}`);

    const bot = new Wallet(privateKey, ethProvider);
    if ((await getChainBalance(bot.address)).lt(DEPOSIT_AMT.div(Two))) {
      console.log(`Sending ${DEPOSIT_AMT} asset to sender: ${abrv(sender.signerAddress)}`);
      const tx = await sendChainBalance(bot.address, DEPOSIT_AMT);
      console.log(`Tx sent: ${tx.hash}, waiting for it to be mined..`);
      await tx.wait();
      console.log(`Tx mined on ${tx.chainId}`);
    }

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
      multisig: ${receiver.multisigAddress}
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

    // COLLATERAL
    const starting = await receiver.getFreeBalance(assetId);
    console.log(
      `Receiver client requesting collateral (precollateral balance: ${formatEther(
        starting[receiver.nodeSignerAddress],
      )}).`,
    );
    const start = Date.now();
    await receiverAgent.requestCollateral(assetId);
    const postCollateral = await receiver.getFreeBalance(assetId);
    console.log(
      `Collateral request complete (postcollateral balance: ${formatEther(
        postCollateral[receiver.nodeSignerAddress],
      )}, elapsed: ${Date.now() - start}).`,
    );

    // SENDER DEPOSIT
    console.log(
      `Sender depositing (onchain balance: ${formatEther(await getChainBalance(bot.address))})`,
    );
    await senderAgent.depositIfNeeded(TRANSFER_AMT, TRANSFER_AMT, assetId);
    console.log(`Deposit complete`);

    let preTransferBalance = await sender.getFreeBalance(assetId);
    console.log(`Pre-transfer balance sender: ${preTransferBalance[sender.signerAddress]}`);

    preTransferBalance = await receiver.getFreeBalance(assetId);
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
      assetId,
      undefined,
      ConditionalTransferTypes.LinkedTransfer,
      ONE_MINUTE,
    );
    await receiverUnlocked;
    await senderUnlocked;
    console.log(`Transfer complete`);

    const postTransferBalanceSender = await sender.getFreeBalance(assetId);
    console.log(`Post-transfer balance sender: ${postTransferBalanceSender[sender.signerAddress]}`);

    const postTransferBalanceReceiver = await receiver.getFreeBalance(assetId);
    console.log(
      `Post-transfer balance receiver: ${postTransferBalanceReceiver[receiver.signerAddress]}`,
    );

    // WITHDRAW
    console.log(`Starting withdrawal`);
    await receiver.withdraw({
      amount: postTransferBalanceReceiver[receiver.signerAddress],
      recipient: receiver.nodeSignerAddress,
      assetId,
    });
    console.log(`Withdrawal complete`);

    const postWithdrawalBalanceReceiver = await receiver.getFreeBalance(assetId);
    console.log(
      `Post-Withdrawal balance receiver: ${postWithdrawalBalanceReceiver[receiver.signerAddress]}`,
    );

    process.exit(0);
  },
};
