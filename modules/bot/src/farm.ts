import { constants } from "ethers";
import { Argv } from "yargs";

import { startBot } from "./agents/bot";

const { AddressZero } = constants;

export default {
  command: "Farm",
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
        default: -1,
      })
      .option("funder-mnemonic", {
        describe: "Mnemonic for the account that can give funds to the bots",
        type: "number",
        default: -1,
      })
      .option("token-address", {
        describe: "Asset id for payments",
        type: "string",
        default: AddressZero,
      });
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    let exitCode = 0;
    for (let concurrencyIndex = 1; concurrencyIndex < argv.concurrency; concurrencyIndex++) {
      exitCode += await startBot(
        concurrencyIndex,
        argv.interval,
        argv.limit,
        argv.logLevel,
        argv.privateKey,
        argv.tokenAddress,
      );
    }
    process.exit(exitCode);
  },
};
