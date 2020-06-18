import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { EventNames } from "@connext/types";
import {
  abrv,
  ColorfulLogger,
  delay,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
  ChannelSigner,
} from "@connext/utils";
import { utils } from "ethers";
import intervalPromise from "interval-promise";
import { Argv } from "yargs";

import { env } from "../env";
import {
  addAgentIdentifierToIndex,
  getRandomAgentIdentifierFromIndex,
  removeAgentIdentifierFromIndex,
  clearRegistry,
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
    const TRANSFER_AMT = parseEther("0.001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
    const limit = argv.limit;
    const start: { [paymentId: string]: number } = {};
    const end: { [paymentId: string]: number } = {};
    let exitCode = 0;

    const randomInterval = Math.round(argv.interval * 0.75 + Math.random() * (argv.interval * 0.5));
    log.info(`Using random inteval: ${randomInterval}`);

    const signer = new ChannelSigner(argv.privateKey, env.ethProviderUrl);
    const client = await connect({
      ...env,
      signer,
      loggerService: new ColorfulLogger(NAME, argv.logLevel, true, argv.concurrencyIndex),
      store: getFileStore(`.connext-store/${signer.address}`),
    });

    log.info(`Client ${argv.concurrencyIndex}:
        publicIdentifier: ${client.publicIdentifier}
        signer: ${client.signerAddress}
        nodeIdentifier: ${client.nodeIdentifier}
        nodeSignerAddress: ${client.nodeSignerAddress}`);

    log.setContext(abrv(client.publicIdentifier));
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
    await addAgentIdentifierToIndex(client.publicIdentifier);

    // Register protocol failure listeners
    let failed: string | undefined = undefined;
    client.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, (msg) => {
      failed = `Stopping interval, caught propose install failed event: ${stringify(msg)}`;
    });
    client.on(EventNames.INSTALL_FAILED_EVENT, (msg) => {
      failed = `Stopping interval, caught install failed event: ${stringify(msg)}`;
    });
    client.on(EventNames.UPDATE_STATE_FAILED_EVENT, (msg) => {
      failed = `Stopping interval, caught take action failed event: ${stringify(msg)}`;
    });
    client.on(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
      failed = `Stopping interval, caught uninstall failed event: ${stringify(msg)}`;
    });

    // Setup agent logic to transfer on an interval
    let sentPayments = 1;
    let unavailableCount = 0;
    await intervalPromise(
      async (_, stop) => {
        log.debug(`heartbeat thump thump`);

        // stop on any protocol failures
        if (failed) {
          log.error(failed);
          await clearRegistry();
          stop();
          return;
        }

        // Only send up to the limit of payments
        if (sentPayments >= limit) {
          await removeAgentIdentifierFromIndex(client.publicIdentifier);
          stop();
          return;
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
          unavailableCount += 1;
        }

        // break if no recipients available
        if (unavailableCount > 5) {
          log.warn(`Could not find recipient for ${unavailableCount} cycles, exiting poller.`);
          stop();
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
            `Sending transfer #${sentPayments}/${limit} to ${abrv(
              receiverIdentifier,
            )} with id ${abrv(paymentId)}`,
          );
          await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT, paymentId);
          end[paymentId] = Date.now();
          log.info(
            `Finished transfer ${abrv(paymentId)} after ${end[paymentId] - start[paymentId]} ms`,
          );
          sentPayments++;
        } catch (err) {
          log.error(`Error sending tranfer: ${err.message}`);
          if (!err.message.includes("timed out after")) {
            exitCode += 1;
            stop();
            // await clearRegistry();
            return;
          }
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
      exitCode += 1;
    }
    log.info(`Payment times: ${stringify(elapsed)}`);
    const average = Object.values(elapsed).reduce((prev, curr) => prev + curr, 0) / numberPayments;
    log.warn(`Average elapsed time across ${numberPayments} payments: ${average}ms`);

    log.warn(`Waiting for other bots to stop sending us payments..`);

    while (true) {
      if (Date.now() - agent.lastReceivedOn > argv.interval * 5) {
        log.warn(
          `No payments recieved for ${Date.now() - agent.lastReceivedOn} ms. Bot ${
            client.publicIdentifier
          } is exiting.`,
        );
        break;
      } else {
        await delay(argv.interval);
      }
    }

    await removeAgentIdentifierFromIndex(client.publicIdentifier);
    await delay(argv.interval * 5); // make sure any in-process payments have time to finish
    process.exit(exitCode);
  },
};
