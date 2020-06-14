import {
  ColorfulLogger,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
} from "@connext/utils";
import { utils } from "ethers";
import { Argv } from "yargs";
import intervalPromise from "interval-promise";

import { createClient } from "../helpers/client";
import {
  addAgentIdentifierToIndex,
  getRandomAgentIdentifierFromIndex,
} from "../helpers/agentIndex";
import { Agent } from "./agent";

const { parseEther, formatEther } = utils;

export default {
  command: "bot",
  describe: "Start the bot",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency-index", {
        description: "Number that identifies this agent when many are running in parallel",
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
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = `Bot #${argv.concurrencyIndex}`;
    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);
    log.info(`Launched bot ${NAME}`);
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;
    const start: { [paymentId: string]: number } = {};

    const randomInterval = Math.round(argv.interval * 0.75 + Math.random() * (argv.interval * 0.5));
    log.info(`Using random inteval: ${randomInterval}`);

    // Create agent + client
    const client = await createClient(
      argv.privateKey,
      NAME,
      log,
      nodeUrl!,
      ethUrl!,
      messagingUrl!,
      argv.logLevel,
    );
    const agent = new Agent(log, client, argv.privateKey);
    log.info("Agent starting up.");
    await agent.start();
    log.info("Agent started.");

    log.info(`Registering address ${client.publicIdentifier}`);
    // Register agent in environment
    await addAgentIdentifierToIndex(client.publicIdentifier);

    let depositLock = false;

    // Setup agent logic to transfer on an interval
    intervalPromise(async () => {
      log.debug(`Started interval`);

      // Deposit if agent is out of funds + if a request isn't already in flight
      if (!depositLock) {
        depositLock = true;
        await agent.depositIfNeeded(TRANSFER_AMT, DEPOSIT_AMT);
        depositLock = false;
      }

      // Get random agent from registry and setup params
      const receiverIdentifier = await getRandomAgentIdentifierFromIndex(client.publicIdentifier);

      if (!receiverIdentifier) {
        return;
      }

      // If this is the first bot, dont transfer and instead wait for the others to come up
      const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);
      const paymentId = getRandomBytes32();
      log.debug(
        `Send conditional transfer ${paymentId} for ${formatEther(
          TRANSFER_AMT,
        )} ETH to ${receiverIdentifier} (${receiverSigner})`,
      );

      start[paymentId] = Date.now();
      try {
        // Send transfer
        log.info(`Starting transfer to ${receiverIdentifier} with signer ${receiverSigner}`);
        await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT, paymentId);
        log.info(
          `Conditional transfer ${paymentId} sent. Elapsed: ${Date.now() - start[paymentId]}`,
        );
      } catch (err) {
        console.error(`Error sending tranfer: ${err.message}`);
      }

      // add slight randomness to interval so that it's somewhere between
      // 75% and 125% of inputted argument
    }, randomInterval);
  },
};
