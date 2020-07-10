import { artifacts } from "@connext/contracts";
import { abrv, toBN } from "@connext/utils";
import { constants, Contract, providers, utils, Wallet, BigNumber } from "ethers";
import { Argv } from "yargs";

import { startBot } from "./agents/bot";
import { env } from "./env";
import { internalBotRegistry } from "./helpers/agentIndex";

const { AddressZero, HashZero, Two } = constants;
const { formatEther, sha256, parseEther } = utils;

export const command = {
  command: "tps",
  describe: "Start a bunch of bots & measure transactions per second",
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
      .option("entropy-seed", {
        describe: "Used to deterministally create multiple bot private keys",
        type: "string",
        default: HashZero,
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
    const ethProvider = new providers.JsonRpcProvider(env.ethProviderUrl);
    const sugarDaddy = Wallet.fromMnemonic(argv.funderMnemonic).connect(ethProvider);
    const startEthBalance = await sugarDaddy.getBalance();

    // sugarDaddy grants each bot some funds to start with
    const ethGrant = "0.05";
    const tokenGrant = "100";

    // Abort if sugarDaddy doesn't have enough ETH to fund all the bots
    if (startEthBalance.lt(parseEther(ethGrant).mul(toBN(argv.concurrency)))) {
      throw new Error(
        `Account ${sugarDaddy.address} has insufficient ETH. ${ethGrant} x ${
          argv.concurrency
        } required, got ${formatEther(startEthBalance)}`,
      );
    }

    // Abort if sugarDaddy doesn't have enough tokens to fund all the bots
    let token: Contract;
    let startTokenBalance: BigNumber;
    if (argv.tokenAddress !== AddressZero) {
      token = new Contract(argv.tokenAddress, artifacts.Token.abi, sugarDaddy);
      startTokenBalance = await token.balanceOf(sugarDaddy.address);
      if (startTokenBalance.lt(parseEther(tokenGrant).mul(toBN(argv.concurrency)))) {
        throw new Error(
          `Account ${sugarDaddy.address} has insufficient ${
            argv.tokenAddress
          } tokens. ${tokenGrant} x ${argv.concurrency} required, got ${formatEther(
            startTokenBalance,
          )}`,
        );
      }
      console.log(
        `SugarDaddy ${abrv(sugarDaddy.address)} has ${formatEther(
          startEthBalance,
        )} ETH & ${formatEther(startTokenBalance)} tokens`,
      );
    } else {
      console.log(`SugarDaddy ${abrv(sugarDaddy.address)} has ${formatEther(startEthBalance)} ETH`);
    }

    // First loop: derive bot keys & provide funding
    const keys: string[] = [];
    for (let concurrencyIndex = 0; concurrencyIndex < argv.concurrency; concurrencyIndex += 1) {
      const newKey =
        keys.length === 0 ? sha256(argv.entropySeed) : sha256(keys[concurrencyIndex - 1]);
      keys[concurrencyIndex] = newKey;
      const bot = new Wallet(newKey, ethProvider);
      if ((await bot.getBalance()).lt(parseEther(ethGrant).div(Two))) {
        console.log(
          `Sending ${ethGrant} ETH to bot #${concurrencyIndex + 1}: ${abrv(bot.address)}`,
        );
        await sugarDaddy.sendTransaction({
          to: bot.address,
          value: parseEther(ethGrant),
        });
      }
      if (
        argv.tokenAddress !== AddressZero &&
        (await token!.balanceOf(bot.address)).lt(parseEther(tokenGrant).div(Two))
      ) {
        console.log(
          `Sending ${tokenGrant} tokens to bot #${concurrencyIndex + 1}: ${abrv(bot.address)}`,
        );
        await token!.transfer(bot.address, tokenGrant);
      }
    }

    // Setup loop for numbers from 0 to concurrencyIndex-1
    const zeroToIndex: number[] = [];
    for (let index = 0; index < argv.concurrency; index += 1) {
      zeroToIndex.push(index);
    }

    // Second loop: start up all of our bots at once & wait for them all to exit
    const botResults = await Promise.all(
      zeroToIndex.map(async (concurrencyIndex) => {
        // start bot & wait until it exits
        try {
          console.log(`Starting bot #${concurrencyIndex + 1}`);
          const result = await startBot(
            concurrencyIndex + 1,
            argv.interval,
            argv.limit,
            argv.logLevel,
            keys[concurrencyIndex],
            argv.tokenAddress,
            internalBotRegistry,
            false,
          );
          return result;
        } catch (e) {
          return { code: 1, txTimestamps: [] };
        }
      }),
    );

    // Print the amount we spent during the course of these tests
    const endEthBalance = await sugarDaddy.getBalance();
    if (argv.tokenAddress !== AddressZero) {
      const endTokenBalance = await token!.balanceOf(sugarDaddy.address);
      console.log(
        `SugarDaddy spent ${formatEther(startEthBalance.sub(endEthBalance))} ETH & ${formatEther(
          startTokenBalance!.sub(endTokenBalance),
        )} tokens`,
      );
    } else {
      console.log(`SugarDaddy spent ${formatEther(startEthBalance.sub(endEthBalance))} ETH`);
    }

    // Print our TPS aka transactions-per-second report
    let tpsData: number[] = [];

    zeroToIndex.forEach((i) => {
      tpsData = tpsData.concat(botResults[i].txTimestamps);
    });
    tpsData = tpsData.sort();

    const start = Math.floor(tpsData[0] / 1000);
    const end = Math.floor(tpsData[tpsData.length - 1] / 1000);
    const avgSpan = 5;
    const movingAverage = {};
    let peak = start;

    for (let t = start; t <= end; t++) {
      movingAverage[t] = 0;
      tpsData.forEach((tx) => {
        if (Math.abs(tx / 1000 - t) <= avgSpan / 2) {
          movingAverage[t] += 1 / avgSpan;
        }
      });
    }

    // Identify the TPS peak & round all numbers so output is a little prettier
    Object.keys(movingAverage).forEach((key) => {
      movingAverage[key] = Math.round(movingAverage[key] * 100) / 100;
      if (movingAverage[key] > movingAverage[peak]) {
        peak = parseInt(key, 10);
      }
    });

    console.log(`${avgSpan} second moving average TPS: ${JSON.stringify(movingAverage, null, 2)}`);
    console.log(`Peak TPS: ${movingAverage[peak]} at ${peak}`);

    process.exit(botResults.reduce((acc, cur) => acc + cur.code, 0));
  },
};
