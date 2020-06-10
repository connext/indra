import { getLocalStore } from "@connext/store";
import { ERC20 } from "@connext/contracts";
import {
  ClientOptions,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
  NodeResponses,
  StateSchemaVersion,
  STORE_SCHEMA_VERSION,
  IChannelSigner,
} from "@connext/types";
import { ChannelSigner, ConsoleLogger, logTime, stringify, delay } from "@connext/utils";

import { Contract, providers } from "ethers";

import { ConnextClient } from "./connext";
import { getDefaultOptions } from "./default";
import { NodeApiClient } from "./node";

export const connect = async (
  clientOptions: string | ClientOptions,
  overrideOptions?: Partial<ClientOptions>,
): Promise<IConnextClient> => {
  const start = Date.now();
  const opts =
    typeof clientOptions === "string"
      ? getDefaultOptions(clientOptions, overrideOptions)
      : clientOptions;

  const {
    channelProvider: providedChannelProvider,
    logger: providedLogger,
    ethProviderUrl,
    loggerService,
    messagingUrl,
    logLevel,
  } = opts;
  let { store, messaging, nodeUrl } = opts;
  if (store) {
    await store.init();
  }

  const logger = loggerService
    ? loggerService.newContext("ConnextConnect")
    : new ConsoleLogger("ConnextConnect", logLevel, providedLogger);

  logger.info(
    `Called connect with ${stringify({ nodeUrl, ethProviderUrl, messagingUrl })}, and ${
      providedChannelProvider!!
        ? `provided channel provider`
        : `signer ${typeof opts.signer === "string" ? `using private key` : `with injected signer`}`
    }`,
  );

  // setup ethProvider + network information
  logger.debug(`Creating ethereum provider - ethProviderUrl: ${ethProviderUrl}`);
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const network = await ethProvider.getNetwork();

  // setup messaging and node api
  let node: INodeApiClient;
  let config: NodeResponses.GetConfig;

  // setup channelProvider
  let channelProvider: IChannelProvider;

  // setup signer
  let signer: IChannelSigner;

  if (providedChannelProvider) {
    channelProvider = providedChannelProvider;
    if (typeof channelProvider.config === "undefined") {
      await channelProvider.enable();
    }
    logger.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    nodeUrl = channelProvider.config.nodeUrl;
    node = await NodeApiClient.init({
      ethProvider,
      messaging,
      messagingUrl,
      logger,
      nodeUrl,
      channelProvider,
    });
    config = node.config;
    messaging = node.messaging;
  } else if (opts.signer) {
    if (!nodeUrl) {
      throw new Error("Client must be instantiated with nodeUrl if not using a channelProvider");
    }

    signer =
      typeof opts.signer === "string"
        ? new ChannelSigner(opts.signer, ethProviderUrl)
        : opts.signer;

    store = store || getLocalStore();

    node = await NodeApiClient.init({
      store,
      ethProvider,
      messaging,
      messagingUrl,
      logger,
      nodeUrl,
      signer,
    });
    config = node.config;
    messaging = node.messaging;
    channelProvider = node.channelProvider;
  } else {
    throw new Error("Must provide channelProvider or signer");
  }

  // create a token contract based on the provided token
  const token = new Contract(config.contractAddresses.Token, ERC20.abi, ethProvider);

  // create appRegistry
  const appRegistry = await node.appRegistry();

  // create the new client
  const client = new ConnextClient({
    appRegistry,
    channelProvider,
    config,
    ethProvider,
    logger,
    messaging,
    network,
    node,
    signer,
    store,
    token,
  });

  logger.info(`Done creating connext client`);

  const isSigner = await client.channelProvider.isSigner();

  // return before any cleanup using the assumption that all injected clients
  // have an online client that it can access that has done the cleanup
  if (!isSigner) {
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  let chan;
  // waits until the setup protocol or create channel call is completed
  await new Promise(async (resolve, reject) => {
    // Wait for channel to be available
    const channelIsAvailable = async (): Promise<boolean> => {
      try {
        chan = await client.node.getChannel();
        return chan && chan.available;
      } catch (e) {
        return false;
      }
    };
    const start = Date.now();
    const MAX_WAIT = 20_000;
    while (!(await channelIsAvailable())) {
      if (Date.now() - start >= MAX_WAIT) {
        return reject(`Could not create channel within ${MAX_WAIT / 1000}s`);
      }
      await delay(MAX_WAIT / 10);
    }
    return resolve();
  });

  logger.info(`Channel is available with multisig address: ${chan.multisigAddress}`);

  try {
    await client.getFreeBalance();
  } catch (e) {
    if (e.message.includes("StateChannel does not exist yet")) {
      logger.info(
        `Our store does not contain channel, attempting to restore: ${e.message}`,
      );
      await client.restoreState();
      logger.info(`State restored successfully`);
    } else {
      logger.error(`Failed to get free balance: ${e.message}`);
      throw e;
    }
  }

  // Make sure our store schema is up-to-date
  const schemaVersion = await client.channelProvider.getSchemaVersion();
  if (!schemaVersion || schemaVersion !== STORE_SCHEMA_VERSION) {
    logger.info(`Store schema is out-of-date (${schemaVersion} !== ${STORE_SCHEMA_VERSION}), restoring state`);
    await client.restoreState();
    logger.info(`State restored successfully`);
    // increment / update store schema version, defaults to types const of `STORE_SCHEMA_VERSION`
    await client.channelProvider.updateSchemaVersion();
  }

  // Make sure our state schema is up-to-date
  const { data: sc } = await client.getStateChannel();
  if (!sc.schemaVersion || sc.schemaVersion !== StateSchemaVersion || !sc.addresses) {
    logger.info(`State schema is out-of-date (${sc.schemaVersion} !== ${StateSchemaVersion}), restoring state`);
    await client.restoreState();
    logger.info(`State restored successfully`);
  }

  logger.debug("Registering subscriptions");
  await client.registerSubscriptions();

  // cleanup any hanging registry apps
  logger.info("Cleaning up registry apps");
  try {
    await client.cleanupRegistryApps();
  } catch (e) {
    logger.error(
      `Could not clean up registry: ${
        e.stack || e.message
      }... will attempt again on next connection`,
    );
  }
  logger.info("Cleaned up registry apps");

  // wait for wd verification to reclaim any pending async transfers
  // since if the hub never submits you should not continue interacting
  logger.info("Reclaiming pending async transfers");
  await client.reclaimPendingAsyncTransfers();
  logger.info("Reclaimed pending async transfers");

  // check in with node to do remaining work
  logger.info("Checking in with node");
  try {
    await client.clientCheckIn();
  } catch (e) {
    logger.error(
      `Could not complete node check-in: ${
        e.stack || e.message
      }... will attempt again on next connection`,
    );
  }
  logger.info("Checked in with node");

  // watch for/prune lingering withdrawals
  logger.info("Getting user withdrawals");
  const previouslyActive = await client.getUserWithdrawals();
  if (previouslyActive.length === 0) {
    logger.info("No user withdrawals found");
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  try {
    logger.info(`Watching for user withdrawals`);
    const transactions = await client.watchForUserWithdrawal();
    if (transactions.length > 0) {
      logger.info(`Found node submitted user withdrawals: ${transactions.map((tx) => tx.hash)}`);
    }
  } catch (e) {
    logger.error(
      `Could not complete watching for user withdrawals: ${
        e.stack || e.message
      }... will attempt again on next connection`,
    );
  }

  logTime(logger, start, `Client ${client.publicIdentifier} successfully connected`);
  return client;
};
