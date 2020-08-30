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
import {
  ChannelSigner,
  ConsoleLogger,
  logTime,
  stringify,
  delay,
  getChainId,
} from "@connext/utils";
import { Watcher } from "@connext/watcher";

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
    ethProviderUrl,
    logLevel,
    logger: providedLogger,
    loggerService,
    messagingUrl,
    nodeUrl,
    middlewareMap,
    skipInitStore,
    watcherEnabled,
    skipSync,
  } = opts;
  let { ethProvider, messaging } = opts;

  const logger = loggerService
    ? loggerService.newContext("ConnextConnect")
    : new ConsoleLogger("ConnextConnect", logLevel, providedLogger);

  const urls = stringify({ ethProviderUrl, nodeUrl, messagingUrl });
  logger.info(
    `Called connect with ${urls}, and ${
      providedChannelProvider!!
        ? `provided channel provider`
        : `signer ${typeof opts.signer === "string" ? `using private key` : `with injected signer`}`
    }`,
  );

  const store = opts.store || getLocalStore();

  if (!skipInitStore) {
    await store.init();
  }

  logger.info(
    `Using ${opts.store ? "given" : "local"} store containing ${
      (await store.getAllChannels()).length
    } channels`,
  );

  // setup ethProvider
  logger.debug(`ethProviderUrl=${ethProviderUrl} | ethProvider=${typeof ethProvider}`);
  let chainId;
  if (!ethProvider && !ethProviderUrl) {
    throw new Error(`One of "ethProvider" or "ethProviderUrl" must be provided`);
  } else if (!ethProvider) {
    chainId = await getChainId(ethProviderUrl);
    ethProvider = new providers.JsonRpcProvider(ethProviderUrl, chainId);
  } else {
    chainId = (await ethProvider.getNetwork()).chainId;
  }

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

    node = await NodeApiClient.init({
      ethProvider,
      messaging,
      messagingUrl,
      logger,
      nodeUrl: channelProvider.config.nodeUrl,
      channelProvider,
      middlewareMap,
      skipSync,
      chainId,
    });
    config = node.config;
    messaging = node.messaging;
  } else if (opts.signer) {
    if (!nodeUrl) {
      throw new Error("Client must be instantiated with nodeUrl if not using a channelProvider");
    }

    signer =
      typeof opts.signer === "string" ? new ChannelSigner(opts.signer, ethProvider) : opts.signer;

    node = await NodeApiClient.init({
      store,
      ethProvider,
      messaging,
      messagingUrl,
      logger,
      nodeUrl,
      signer,
      skipSync,
      chainId,
    });
    config = node.config;
    messaging = node.messaging;
    channelProvider = node.channelProvider;
  } else {
    throw new Error("Must provide channelProvider or signer");
  }

  // create watcher, which is enabled by default
  const watcher = await Watcher.init({
    signer,
    providers: {},
    context: node.config.contractAddresses,
    store,
  });
  if (!watcherEnabled) {
    await watcher.disable();
  }

  // create a token contract based on the provided token
  const token = new Contract(config.contractAddresses[chainId].Token, ERC20.abi, ethProvider);

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
    network: await ethProvider.getNetwork(),
    node,
    signer,
    store,
    token,
    chainId,
    watcher,
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
      logger.info(`Our store does not contain channel, attempting to restore: ${e.message}`);
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
    logger.info(
      `Store schema is out-of-date (${schemaVersion} !== ${STORE_SCHEMA_VERSION}), restoring state`,
    );
    await client.restoreState();
    logger.info(`State restored successfully`);
    // increment / update store schema version, defaults to types const of `STORE_SCHEMA_VERSION`
    await client.channelProvider.updateSchemaVersion();
  }

  // Make sure our state schema is up-to-date
  const { data: sc } = await client.getStateChannel();
  if (!sc.schemaVersion || sc.schemaVersion !== StateSchemaVersion || !sc.addresses) {
    logger.info(
      `State schema is out-of-date (${sc.schemaVersion} !== ${StateSchemaVersion}), restoring state`,
    );
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
  logger.debug("Getting user withdrawals");
  const previouslyActive = await client.getUserWithdrawals();
  if (previouslyActive.length === 0) {
    logger.debug("No user withdrawals found");
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  try {
    await client.watchForUserWithdrawal();
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
