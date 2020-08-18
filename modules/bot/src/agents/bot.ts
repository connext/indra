import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { EventNames } from "@connext/types";
import {
  abbreviate,
  ColorfulLogger,
  delay,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
  ChannelSigner,
} from "@connext/utils";
import { utils, constants } from "ethers";
import intervalPromise from "interval-promise";
import { Argv } from "yargs";

import { env } from "../env";
import { BotRegistry, externalBotRegistry } from "../helpers/agentIndex";

import { Agent } from "./agent";

const { parseEther, formatEther } = utils;
const { AddressZero } = constants;

export const startBot = async (
  concurrencyIndex: number,
  interval: number,
  limit: number,
  logLevel: number,
  privateKey: string,
  tokenAddress: string,
  registry: BotRegistry = externalBotRegistry,
  errorOnProtocolFailure: boolean = true,
): Promise<{
  code: number;
  txTimestamps: number[];
}> => {
  const NAME = `Bot #${concurrencyIndex}`;
  const log = new ColorfulLogger(NAME, 3, true, concurrencyIndex);
  log.info(`Launched ${NAME}, paying in ${tokenAddress}`);
  const TRANSFER_AMT = parseEther("0.001");
  const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth
  const start: { [paymentId: string]: number } = {};
  const end: { [paymentId: string]: number } = {};
  let exitCode = 0;

  const randomInterval = Math.round(interval * 0.75 + Math.random() * (interval * 0.5));
  log.info(`Using random inteval: ${randomInterval}`);

  const signer = new ChannelSigner(privateKey, env.ethProviderUrl);
  let client;
  try {
    client = await connect({
      ...env,
      signer,
      loggerService: new ColorfulLogger(NAME, logLevel, true, concurrencyIndex),
      store: getFileStore(`.bot-store/${signer.publicIdentifier}`),
    });
  } catch (e) {
    log.error(`Couldn't create client for ${NAME}: ${e.stack}`);
    throw e;
  }

  log.info(`Client ${concurrencyIndex}:
      publicIdentifier: ${client.publicIdentifier}
      signer: ${client.signerAddress}
      nodeIdentifier: ${client.nodeIdentifier}
      nodeSignerAddress: ${client.nodeSignerAddress}`);

  log.setContext(abbreviate(client.publicIdentifier));
  const agent = new Agent(log, client, privateKey, errorOnProtocolFailure);
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
  await registry.add(client.publicIdentifier);
  log.info(`Address registered`);

  // Register protocol failure listeners
  let protocolFailure: string | undefined = undefined;
  client.on(EventNames.PROPOSE_INSTALL_FAILED_EVENT, (msg) => {
    protocolFailure = `Stopping interval, caught propose install failed event: ${stringify(msg)}`;
  });
  client.on(EventNames.INSTALL_FAILED_EVENT, (msg) => {
    protocolFailure = `Stopping interval, caught install failed event: ${stringify(msg)}`;
  });
  client.on(EventNames.UPDATE_STATE_FAILED_EVENT, (msg) => {
    protocolFailure = `Stopping interval, caught take action failed event: ${stringify(msg)}`;
  });
  client.on(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
    protocolFailure = `Stopping interval, caught uninstall failed event: ${stringify(msg)}`;
  });

  // Setup agent logic to transfer on an interval
  let sentPayments = 0;
  let unavailableCount = 0;
  await intervalPromise(
    async (_, stop) => {
      log.debug(`heartbeat thump thump`);

      // stop on any protocol failures
      if (protocolFailure && errorOnProtocolFailure) {
        log.error(protocolFailure);
        stop();
        return;
      }

      // Only send up to the limit of payments
      if (limit > 0 && sentPayments >= limit) {
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
      const receiverIdentifier = await registry.getRandom(client.publicIdentifier);

      if (!receiverIdentifier) {
        log.warn(`No recipients are available. Doing nothing..`);
        unavailableCount += 1;
        await delay(500); // Add a little extra delay so other bots have a chance to wake up
      }

      // break if no recipients available
      if (unavailableCount > 10) {
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
          `Sending transfer #${sentPayments}/${limit} to ${abbreviate(
            receiverIdentifier,
          )} with id ${abbreviate(paymentId)}`,
        );
        await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT, tokenAddress, paymentId);
        end[paymentId] = Date.now();
        log.info(
          `Finished transfer ${abbreviate(paymentId)} after ${
            end[paymentId] - start[paymentId]
          } ms`,
        );
        sentPayments++;
      } catch (err) {
        log.error(`Error sending tranfer: ${err.message}`);
        if (!err.message.includes("timed out after")) {
          exitCode += 1;
          stop();
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
  }
  log.info(`Payment times: ${stringify(elapsed)}`);
  const average = Object.values(elapsed).reduce((prev, curr) => prev + curr, 0) / numberPayments;
  log.warn(`Average elapsed time across ${numberPayments} payments: ${average}ms`);

  log.warn(`Waiting for other bots to stop sending us payments..`);

  while (true) {
    if (Date.now() - agent.lastReceivedOn > (interval + 100) * 5) {
      log.warn(
        `No payments recieved for ${Date.now() - agent.lastReceivedOn} ms. Bot ${
          client.publicIdentifier
        } is exiting.`,
      );
      break;
    } else {
      await delay(interval + 100);
    }
  }

  await registry.remove(client.publicIdentifier);
  await delay((interval + 100) * 5); // make sure any in-process payments have time to finish

  const txTimestamps: number[] = [];
  Object.values(end).forEach((tx) => {
    txTimestamps.push(tx);
  });

  return { code: exitCode, txTimestamps };
};

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
      .option("token-address", {
        describe: "Asset id for payments",
        type: "string",
        default: AddressZero,
      })
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const result = await startBot(
      argv.concurrencyIndex,
      argv.interval,
      argv.limit,
      argv.logLevel,
      argv.privateKey,
      argv.tokenAddress,
    );
    process.exit(result.code);
  },
};
