import {
  ColorfulLogger,
  delay,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
} from "@connext/utils";
import { EventNames } from "@connext/types";
import { utils } from "ethers";
import { Argv } from "yargs";
import intervalPromise from "interval-promise";

import { createClient } from "../helpers/client";
import {
  addAgentIdentifierToIndex,
  getRandomAgentIdentifierFromIndex,
  removeAgentIdentifierFromIndex,
} from "../helpers/agentIndex";
import { Agent } from "./agent";

const { parseEther, formatEther } = utils;

// Bot should crash if an unhandled promise rejection slips through.
process.on("unhandledRejection", () => {
  console.log(`UnhandledPromiseRejection detected. Crashing..`);
  process.exit(1);
});

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
      .option("limit", {
        describe: "The maximum number of payments to send before exiting (0 for no limit)",
        type: "number",
        default: -1,
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
    log.info(`Launched ${NAME}`);
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;
    const limit = argv.limit;
    const start: { [paymentId: string]: number } = {};
    const end: { [paymentId: string]: number } = {};

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

    let depositLock = true;
    await agent.depositIfNeeded(TRANSFER_AMT, DEPOSIT_AMT);
    depositLock = false;

    // Register listener
    client.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (eData) => {
      log.debug(`Received transfer: ${stringify(eData)}`);
    });

    log.info(`Registering address ${client.publicIdentifier}`);
    // Register agent in environment
    await addAgentIdentifierToIndex(client.publicIdentifier);

    // Setup agent logic to transfer on an interval
    let sentPayments = 1;
    await intervalPromise(
      async (_, stop) => {
        log.debug(`Started interval`);

        // Only send up to the limit of payments
        if (sentPayments >= limit) {
          stop();
        }

        // Deposit if agent is out of funds + if a request isn't already in flight
        if (!depositLock) {
          depositLock = true;
          await agent.depositIfNeeded(TRANSFER_AMT, DEPOSIT_AMT);
          depositLock = false;
        }

        // Get random agent from registry and setup params
        const receiverIdentifier = await getRandomAgentIdentifierFromIndex(client.publicIdentifier);

        if (!receiverIdentifier) {
          log.warn(`No recipients are available. Doing nothing..`);
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
          log.info(
            `Sending transfer #${sentPayments}/${limit} to ${receiverIdentifier} with signer ${receiverSigner}`,
          );
          await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT, paymentId);
          end[paymentId] = Date.now();
          log.info(
            `Sent Conditional transfer #${sentPayments}/${limit} with ${paymentId} sent. Elapsed: ${
              end[paymentId] - start[paymentId]
            }`,
          );
          sentPayments++;
        } catch (err) {
          console.error(`Error sending tranfer: ${err.message}`);
          stop();
        }
      },
      // add slight randomness to interval so that it's somewhere between
      // 75% and 125% of inputted argument
      randomInterval,
      { stopOnError: false },
    );

    log.warn(`Done sending payments`);

    const elapsed: { [paymentId: string]: number } = {};
    Object.entries(start).forEach(([paymentId, startTime]) => {
      if (!end[paymentId]) {
        return;
      }
      return (elapsed[paymentId] = end[paymentId] - startTime);
    });
    const numberPayments = Object.keys(elapsed).length;
    if (numberPayments < limit) {
      log.error(`Only able to run ${numberPayments}/${limit} requested payments before exiting.`);
    }
    log.info(`Payment times: ${stringify(elapsed)}`);
    const average = Object.values(elapsed).reduce((prev, curr) => prev + curr, 0) / numberPayments;
    log.warn(`Average elapsed time across ${numberPayments} payments: ${average}ms`);

    log.warn(`Waiting for other bots to stop sending us payments..`);
    while (true) {
      const diff = Date.now() - agent.lastReceivedOn;
      if (diff > argv.interval * 5) {
        log.warn(
          `We haven't recieved a payment in ${diff} ms. Bot ${client.publicIdentifier} is exiting.`,
        );
        break;
      } else {
        await delay(argv.interval);
      }
    }
    await removeAgentIdentifierFromIndex(client.publicIdentifier);
    process.exit(0);
  },
};
