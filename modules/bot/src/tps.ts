import { artifacts } from "@connext/contracts";
import {
  abrv,
  toBN,
  getSignerAddressFromPublicIdentifier,
  getRandomBytes32,
  ColorfulLogger,
  delay,
  stringify,
} from "@connext/utils";
import { constants, Contract, providers, utils, Wallet } from "ethers";
import { Argv } from "yargs";

import { env } from "./env";
import { internalBotRegistry, BotRegistry } from "./helpers/agentIndex";
import { createAndFundClient } from "./helpers/createAndFundClient";
import { Agent } from "./agents/agent";
import { Address } from "@connext/types";
import { writeJson } from "./helpers/writeJson";

const { AddressZero, HashZero } = constants;
const { formatEther, sha256, parseEther } = utils;

export const command = {
  command: "tps",
  describe: "Start a bunch of bots & measure transactions per second",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency", {
        description: "Max number of bots to run in parallel",
        type: "string",
        default: "1",
      })
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 1,
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
    let token;
    let startTokenBalance;
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

    // Derive agents & provide channel funding
    const keys: string[] = [];
    const agents: Agent[] = [];
    for (let concurrencyIndex = 0; concurrencyIndex < argv.concurrency; concurrencyIndex += 1) {
      const newKey =
        keys.length === 0 ? sha256(argv.entropySeed) : sha256(keys[concurrencyIndex - 1]);
      keys[concurrencyIndex] = newKey;
      const grants = [
        {
          grantAmt: argv.tokenAddress === AddressZero ? ethGrant : tokenGrant,
          assetId: argv.tokenAddress,
        },
      ];
      const client = await createAndFundClient(sugarDaddy, grants, newKey);

      // Add client to registry
      await internalBotRegistry.add(client.publicIdentifier);

      // Create and start agent
      const NAME = `Bot #${concurrencyIndex}`;
      const log = new ColorfulLogger(NAME, 3, true, concurrencyIndex);
      const agent = new Agent(log, client, newKey, false);
      agents.push(agent);
    }

    // Begin TPS testing
    console.log(`Created and funded bots, beginning tps test with up to ${agents.length} bots`);
    const toTest: Agent[] = [];
    const results: TpsResult[] = [];
    const copy = [...agents];
    for (let i = 0; i < agents.length; i++) {
      const top = copy.shift();
      if (!top) {
        console.log("No more agents, tps tests completed");
        break;
      }
      toTest.push(top);
      console.log(`Starting tps cycle with ${toTest.length} bots`);
      const testResult = await runTpsTest(toTest, argv.tokenAddress);
      console.log(`Test cycle complete: ${stringify(testResult)}`);
      results.push(testResult);
      // wait 15s for payments/queues to clear
      if (testResult.paymentsSent > 0) {
        console.log(`Waiting 15s for agents to complete or timeout payments`);
        await delay(15000);
      }
    }

    // Write results to file
    console.log(`Tests complete, storing data`);
    writeJson(results, `.results/${Date.now()}.json`);
    console.log(
      `TPS testing with total of ${argv.concurrency} bots complete, results:`,
      stringify(results),
    );

    // Print the amount we spent during the course of these tests
    console.log(`TRYING TO GET END ETH BALANCE`);
    const endEthBalance = await sugarDaddy.getBalance();
    if (argv.tokenAddress !== AddressZero) {
      const endTokenBalance = await token.balanceOf(sugarDaddy.address);
      console.log(
        `SugarDaddy spent ${formatEther(startEthBalance.sub(endEthBalance))} ETH & ${formatEther(
          startTokenBalance.sub(endTokenBalance),
        )} tokens`,
      );
    } else {
      console.log(`SugarDaddy spent ${formatEther(startEthBalance.sub(endEthBalance))} ETH`);
    }
    process.exit(0);
  },
};

type TpsResult = { numberBots: number; paymentsSent: number; paymentsResolved: number };
const runTpsTest = async (
  agents: Agent[],
  assetId: Address,
  registry: BotRegistry = internalBotRegistry,
): Promise<TpsResult> => {
  // Setup tracking + listeners
  let paymentsSent = 0;
  let paymentsResolved = 0;

  agents.forEach((agent) => {
    agent.nodeReclaim.attach((data) => {
      paymentsResolved += 1;
      console.log(`Resolved payment #${paymentsResolved}`);
    });

    agent.senderCreated.attach((data) => {
      paymentsSent += 1;
      console.log(`Sent payment #${paymentsSent}`);
    });
  });

  // Wait until recipients are available before starting test
  while (!(await registry.getRandom(agents[0].client.publicIdentifier))) {
    await delay(1000);
  }

  // Begin sending payments
  const end = Date.now() + 1000;
  let idx = 0;
  while (Date.now() < end) {
    const sender = agents[idx];
    const recipient = await registry.getRandom(sender.client.publicIdentifier);
    if (!recipient) {
      // ignore
      continue;
    }
    const paymentId = getRandomBytes32();
    await agents[idx]
      .pay(recipient, getSignerAddressFromPublicIdentifier(recipient), toBN(1), assetId, paymentId)
      .catch((e) => {
        // console.error(`Error sending payment: ${e.message}`);
      });
    // Move to next bot in array or wrap
    idx = idx === agents.length - 1 ? 0 : idx + 1;
  }

  return { numberBots: agents.length, paymentsSent, paymentsResolved };
};
