import { artifacts } from "@connext/contracts";
import { abrv, getRandomPrivateKey, toBN } from "@connext/utils";
import { constants, Contract, providers, utils, Wallet } from "ethers";
import { Argv } from "yargs";

import { env } from "./env";
import { startBot } from "./agents/bot";

const { AddressZero } = constants;
const { formatEther, parseEther } = utils;

export const command = {
  command: "farm",
  describe: "Start a bunch of bots",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency", {
        description: "Number of bots to run in parallel",
        type: "string",
        default: "1",
      })
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 1,
      })
      .option("interval", {
        describe: "The time interval between consecutive payments from this agent (in ms)",
        type: "number",
        default: 1000,
      })
      .option("limit", {
        describe: "The maximum number of payments to send before exiting (0 for no limit)",
        type: "number",
        default: 0,
      })
      .option("funder-mnemonic", {
        describe: "Mnemonic for the account that can give funds to the bots",
        type: "string",
        default: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
      })
      .option("token-address", {
        describe: "Asset id for payments",
        type: "string",
        default: AddressZero,
      });
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    console.log(`\nLet's farm!`);
    const ethProvider = new providers.JsonRpcProvider(env.ethProviderUrl);
    const sugarDaddy = Wallet.fromMnemonic(argv.funderMnemonic).connect(ethProvider);
    const ethBalance = await sugarDaddy.getBalance();

    // sugarDaddy grants each bot some funds to start with
    const ethGrant = "0.05";
    const tokenGrant = "100";

    // Abort if sugarDaddy doesn't have enough ETH to fund all the bots
    if (ethBalance.lt(parseEther(ethGrant).mul(toBN(argv.concurrency)))) {
      throw new Error(
        `Account ${sugarDaddy.address} has insufficient ETH. ${ethGrant} x ${argv.concurrency} required, got ${formatEther(ethBalance)}`,
      );
    }

    // Abort if sugarDaddy doesn't have enough tokens to fund all the bots
    let token;
    if (argv.tokenAddress !== AddressZero) {
      token = new Contract(argv.tokenAddress, artifacts.Token.abi, sugarDaddy);
      const tokenBalance = await token.balanceOf(sugarDaddy.address);
      if (tokenBalance.lt(parseEther(tokenGrant).mul(toBN(argv.concurrency)))) {
        throw new Error(
          `Account ${sugarDaddy.address} has insufficient ${argv.tokenAddress} tokens. ${tokenGrant} x ${argv.concurrency} required, got ${formatEther(tokenBalance)}`,
        );
      }
      console.log(`SugarDaddy ${abrv(sugarDaddy.address)} has ${formatEther(ethBalance)} ETH & ${formatEther(tokenBalance)} tokens`);
    } else {
      console.log(`SugarDaddy ${abrv(sugarDaddy.address)} has ${formatEther(ethBalance)} ETH`);
    }

    // First loop: set up new bot keys & provide funding
    const keys: string[] = [];
    for (let concurrencyIndex = 0; concurrencyIndex < argv.concurrency; concurrencyIndex +=1 ) {
      const newKey = getRandomPrivateKey();
      const bot = new Wallet(newKey, ethProvider);
      console.log(`Funding bot #${concurrencyIndex + 1}: ${abrv(bot.address)}`);
      keys[concurrencyIndex] = newKey;
      await sugarDaddy.sendTransaction({
        to: bot.address,
        value: parseEther("0.05"),
      });
      if (argv.tokenAddress !== AddressZero) {
        await token.transfer(bot.address, "100");
      }
    }

    console.log(`Done funding bots`);

    // Setup loop for numbers from 0 to concurrencyIndex-1
    const zeroToIndex: number[] = [];
    for (let index = 0; index < argv.concurrency; index += 1) {
      zeroToIndex.push(index);
    }

    // Second pass: start up all of our bots at once & wait for them all to exit
    const botExitCodes = await Promise.all(zeroToIndex.map(concurrencyIndex => {
      // start bot & wait until it exits
      try {
        console.log(`Starting bot #${concurrencyIndex + 1}`);
        return startBot(
          concurrencyIndex + 1,
          argv.interval,
          argv.limit,
          argv.logLevel,
          keys[concurrencyIndex],
          argv.tokenAddress,
        );
      } catch (e) {
        return 1;
      }
    }));

    // TODO: Bots should return all excess funds to sugarDaddy before exiting

    process.exit(botExitCodes.reduce((acc, cur) => acc + cur, 0));
  },
};
