import { ChannelSigner } from "@connext/crypto";
import {
  ClientOptions,
  ConnextClientStorePrefix,
  CreateChannelMessage,
  EventNames,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
  MethodResults,
  NodeResponses,
  StateSchemaVersion,
  STORE_SCHEMA_VERSION,
  logTime,
} from "@connext/types";
import { NodeApiClient } from "@connext/channel-provider";
import { Contract, providers, Wallet } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { createCFChannelProvider } from "./channelProvider";
import { ConnextClient } from "./connext";
import { delayAndThrow, getDefaultOptions, Logger, stringify } from "./lib";

export const connect = async (
  clientOptions: string | ClientOptions,
  overrideOptions?: Partial<ClientOptions>,
): Promise<IConnextClient> => {
  const start = Date.now();
  const opts =
    typeof clientOptions === "string"
      ? await getDefaultOptions(clientOptions, overrideOptions)
      : clientOptions;

  const {
    channelProvider: providedChannelProvider,
    ethProviderUrl,
    logger: providedLogger,
    loggerService,
    logLevel,
    mnemonic,
  } = opts;
  let { store, messaging, nodeUrl, messagingUrl, signer } = opts;

  const logger = loggerService
    ? loggerService.newContext("ConnextConnect")
    : new Logger("ConnextConnect", logLevel, providedLogger);

  // setup ethProvider + network information
  logger.debug(`Creating ethereum provider - ethProviderUrl: ${ethProviderUrl}`);
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const network = await ethProvider.getNetwork();

  // setup messaging and node api
  let node: INodeApiClient;
  let nodeConfig: NodeResponses.GetConfig;
  let userIdentifier: string;

  // setup channelProvider
  let channelProvider: IChannelProvider;
  let isInjected = !!providedChannelProvider;

  if (providedChannelProvider) {
    channelProvider = providedChannelProvider;
    if (typeof channelProvider.config === "undefined") {
      await channelProvider.enable();
    }
    logger.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    nodeUrl = channelProvider.config.nodeUrl;
    node = await NodeApiClient.init({ messaging, messagingUrl, logger, nodeUrl, channelProvider });
    nodeConfig = node.config;
    messaging = node.messaging;
    userIdentifier = channelProvider.config.userIdentifier;

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userIdentifier = userIdentifier;
    node.nodeIdentifier = nodeConfig.nodeIdentifier;
  } else if (signer || mnemonic) {
    if (!nodeUrl) {
      throw new Error("Client must be instantiated with nodeUrl if not using a channelProvider");
    }

    if (!signer && mnemonic) {
      const pk = Wallet.fromMnemonic(mnemonic).privateKey;
      logger.warn(`Client instantiation with mnemonic is only recommended for dev usage`);
      signer = new ChannelSigner(pk, ethProviderUrl);
    }

    // create a new node api instance
    node = await NodeApiClient.init({ messaging, messagingUrl, logger, nodeUrl, signer });
    nodeConfig = node.config;
    messaging = node.messaging;
    userIdentifier = signer.publicIdentifier;

    // ensure that node and user identifiers are different
    if (nodeConfig.nodeIdentifier === userIdentifier) {
      throw new Error(
        "Client must be instantiated with a signer that is different from the node's",
      );
    }

    channelProvider = await createCFChannelProvider({
      contractAddresses: nodeConfig.contractAddresses,
      ethProvider,
      lockService: { acquireLock: node.acquireLock.bind(node) },
      logger,
      messaging,
      node,
      nodeConfig: { STORE_KEY_PREFIX: ConnextClientStorePrefix },
      nodeUrl,
      signer,
      store,
    });

    logger.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userIdentifier = userIdentifier;
    node.nodeIdentifier = nodeConfig.nodeIdentifier;
  } else {
    throw new Error("Must provide channelProvider or signer");
  }

  // setup multisigAddress + assign to channelProvider
  const myChannel = await node.getChannel();

  let multisigAddress: string;
  if (!myChannel) {
    logger.debug("no channel detected, creating channel..");
    const creationEventData = await Promise.race([
      delayAndThrow(30_000, "Create channel event not fired within 30s"),
      new Promise(
        async (res: any): Promise<any> => {
          channelProvider.once(
            EventNames.CREATE_CHANNEL_EVENT,
            (data: CreateChannelMessage): void => {
              logger.debug(`Received CREATE_CHANNEL_EVENT`);
              res(data.data);
            },
          );

          // FYI This continues async in the background after CREATE_CHANNEL_EVENT is recieved
          const creationData = await node.createChannel();
          logger.debug(`created channel, transaction: ${stringify(creationData)}`);
        },
      ),
    ]);
    multisigAddress = (creationEventData as MethodResults.CreateChannel).multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }
  logger.debug(`multisigAddress: ${multisigAddress}`);

  channelProvider.multisigAddress = multisigAddress;

  // create a token contract based on the provided token
  const token = new Contract(nodeConfig.contractAddresses.Token, tokenAbi, ethProvider);

  // create appRegistry
  const appRegistry = await node.appRegistry();

  // create the new client
  const client = new ConnextClient({
    appRegistry,
    channelProvider,
    ethProvider,
    logger,
    network,
    token,
  });

  logger.debug(`Done creating connext client`);

  // return before any cleanup using the assumption that all injected clients
  // have an online client that it can access that has done the cleanup
  if (isInjected) {
    logTime(logger, start, `Client successfully connected`);
    return client;
  }

  // waits until the setup protocol or create channel call is completed
  await Promise.race([
    new Promise(
      async (resolve: any, reject: any): Promise<any> => {
        // Wait for channel to be available
        const channelIsAvailable = async (): Promise<boolean> => {
          const chan = await node.getChannel();
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
  const schemaVersion = await store.getSchemaVersion();
  if (!schemaVersion || schemaVersion !== STORE_SCHEMA_VERSION) {
    logger.debug(`Outdated store schema detected, restoring state`);
    await client.restoreState();
    // increment / update store schema version, defaults to types const
    // of `STORE_SCHEMA_VERSION`
    await store.updateSchemaVersion();
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
  await client.cleanupRegistryApps();

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
      `Could not reclaim pending async transfers: ${e}... will attempt again on next connection`,
    );
  }

  // check in with node to do remaining work
  try {
    await client.clientCheckIn();
  } catch (e) {
    logger.error(`Could not complete node check-in: ${e}... will attempt again on next connection`);
  }

  logTime(logger, start, `Client successfully connected`);
  return client;
};
