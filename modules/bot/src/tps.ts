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
import { createAndFundClient } from "./helpers/createAndFundBot";
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

    // Derive bot keys & provide channel funding
    const keys: string[] = [];
    const agents: Agent[] = [];
    for (let concurrencyIndex = 0; concurrencyIndex < argv.concurrency; concurrencyIndex += 1) {
      const newKey =
        keys.length === 0 ? sha256(argv.entropySeed) : sha256(keys[concurrencyIndex - 1]);
      keys[concurrencyIndex] = newKey;
      const client = await createAndFundClient(
        sugarDaddy,
        [
          { grantAmt: ethGrant, assetId: AddressZero },
          { grantAmt: tokenGrant, assetId: token.address },
        ],
        newKey,
      );

      // Add client to registry
      await internalBotRegistry.add(client.publicIdentifier);

      // Create and start agent
      const NAME = `Bot #${concurrencyIndex}`;
      const log = new ColorfulLogger(NAME, 3, true, concurrencyIndex);
      const agent = new Agent(log, client, newKey, false);
      agents.push(agent);
    }

    // Begin TPS testing
    const toTest: Agent[] = [];
    const results: TpsResult[] = [];
    for (let i = 0; i < agents.length; i++) {
      const top = agents.shift();
      if (!top) {
        console.log("No more agents, tps tests completed");
        break;
      }
      toTest.push(top);
      const testResult = await runTpsTest(toTest, token.address);
      results.push(testResult);
      // wait 15s for payments/queues to clear
      console.log(`Waiting 15s for agents to complete or timeout payments`);
      await delay(15000);
    }

    // Write results to file
    console.log(`Tests complete, storing data`);
    const path = `.results/${Date.now()}`;
    writeJson(results, path);
    console.log(`TPS testing with ${argv.concurrency} bots complete, results:`, stringify(results));

    // Print the amount we spent during the course of these tests
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
export const runTpsTest = async (
  agents: Agent[],
  assetId: Address = AddressZero,
  registry: BotRegistry = internalBotRegistry,
): Promise<TpsResult> => {
  // Setup tracking + listeners
  let paymentsSent = 0;
  let paymentsResolved = 0;

  agents.forEach((agent) => {
    agent.nodeReclaim.attach((data) => (paymentsResolved += 1));
  });

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
    agents[idx]
      .pay(recipient, getSignerAddressFromPublicIdentifier(recipient), toBN(1), assetId, paymentId)
      .then((res) => (paymentsSent += 1));
    // Move to next bot in array or wrap
    idx = idx === agents.length - 1 ? 0 : idx + 1;
  }

  return { numberBots: agents.length, paymentsSent, paymentsResolved };
};
