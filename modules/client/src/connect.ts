import {
  ClientOptions,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
  NodeResponses,
  StateSchemaVersion,
  STORE_SCHEMA_VERSION,
  IChannelSigner,
  StoreTypes,
} from "@connext/types";
import { ChannelSigner, ConsoleLogger, delayAndThrow, logTime, stringify } from "@connext/utils";

import { Contract, providers } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { ConnextClient } from "./connext";
import { getDefaultOptions } from "./default";
import { NodeApiClient } from "./node";
import { ConnextStore } from "@connext/store";

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
    logLevel,
  } = opts;
  let { store, messaging, nodeUrl, messagingUrl } = opts;

  const logger = loggerService
    ? loggerService.newContext("ConnextConnect")
    : new ConsoleLogger("ConnextConnect", logLevel, providedLogger);

  logger.info(`Called connect with opts: ${stringify(opts)}`);
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
      typeof opts.signer === "string" ? new ChannelSigner(opts.signer, ethProvider) : opts.signer;

    store = store || new ConnextStore(StoreTypes.LocalStorage);

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
  const token = new Contract(config.contractAddresses.Token, tokenAbi, ethProvider);

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

  logger.debug(`Done creating connext client`);

  const isSigner = await client.channelProvider.isSigner();

  // return before any cleanup using the assumption that all injected clients
  // have an online client that it can access that has done the cleanup
  if (!isSigner) {
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  // waits until the setup protocol or create channel call is completed
  await Promise.race([
    new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        // Wait for channel to be available
        const channelIsAvailable = async (): Promise<boolean> => {
          const chan = await client.node.getChannel();
          return chan && chan.available;
        };
        while (!(await channelIsAvailable())) {
          await new Promise((res: any): any => setTimeout((): void => res(), 1000));
        }
        resolve();
      },
    ),
    delayAndThrow(30_000, "Channel was not available after 30 seconds."),
  ]);

  logger.debug(`Channel is available`);

  // Make sure our store schema is up-to-date
  const schemaVersion = await client.channelProvider.getSchemaVersion();
  if (!schemaVersion || schemaVersion !== STORE_SCHEMA_VERSION) {
    logger.debug(`Outdated store schema detected, restoring state`);
    await client.restoreState();
    // increment / update store schema version, defaults to types const
    // of `STORE_SCHEMA_VERSION`
    await client.channelProvider.updateSchemaVersion();
  }

  try {
    await client.getFreeBalance();
  } catch (e) {
    if (e.message.includes("StateChannel does not exist yet")) {
      logger.debug(`Restoring client state: ${e.stack || e.message}`);
      await client.restoreState();
    } else {
      logger.error(`Failed to get free balance: ${e.stack || e.message}`);
      throw e;
    }
  }

  // Make sure our state schema is up-to-date
  const { data: sc } = await client.getStateChannel();
  if (!sc.schemaVersion || sc.schemaVersion !== StateSchemaVersion || !sc.addresses) {
    logger.debug("State schema is out-of-date, restoring an up-to-date client state");
    await client.restoreState();
  }

  logger.debug("Registering subscriptions");
  await client.registerSubscriptions();

  // cleanup any hanging registry apps
  logger.debug("Cleaning up registry apps");
  try {
    await client.cleanupRegistryApps();
  } catch (e) {
    logger.error(
      `Could not clean up registry: ${e.stack ||
        e.message}... will attempt again on next connection`,
    );
  }

  // wait for wd verification to reclaim any pending async transfers
  // since if the hub never submits you should not continue interacting
  logger.debug("Reclaiming pending async transfers");
  // NOTE: Removing the following await results in a subtle race condition during bot tests.
  //       Don't remove this await again unless you really know what you're doing & bot tests pass
  // no need to await this if it needs collateral
  // TODO: without await causes race conditions in bot, refactor to
  // use events
  try {
    await client.reclaimPendingAsyncTransfers();
  } catch (e) {
    logger.error(
      `Could not reclaim pending async transfers: ${e.stack ||
        e.message}... will attempt again on next connection`,
    );
  }
  logger.debug("Reclaimed pending async transfers");

  // check in with node to do remaining work
  logger.debug("Checking in with node");
  try {
    await client.clientCheckIn();
  } catch (e) {
    logger.error(
      `Could not complete node check-in: ${e.stack ||
        e.message}... will attempt again on next connection`,
    );
  }
  logger.debug("Checked in with node");

  // watch for/prune lingering withdrawals
  logger.debug("Getting user withdrawals");
  const previouslyActive = await client.getUserWithdrawals();
  if (previouslyActive.length === 0) {
    logger.debug("No user withdrawals found");
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  try {
    logger.debug(`Watching for user withdrawals`);
    const transactions = await client.watchForUserWithdrawal();
    if (transactions.length > 0) {
      logger.debug(`Found node submitted user withdrawals: ${transactions.map(tx => tx.hash)}`);
    }
  } catch (e) {
    logger.error(
      `Could not complete watching for user withdrawals: ${e.stack ||
        e.message}... will attempt again on next connection`,
    );
  }

  logTime(logger, start, `Client ${client.publicIdentifier} successfully connected`);
  return client;
};
