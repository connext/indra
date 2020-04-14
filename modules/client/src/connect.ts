import { ChannelSigner } from "@connext/crypto";
import { MessagingService } from "@connext/messaging";
import {
  ChannelMethods,
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
  IChannelSigner,
} from "@connext/types";
import { Contract, providers } from "ethers";
import tokenAbi from "human-standard-token-abi";

import { createCFChannelProvider } from "./channelProvider";
import { ConnextClient } from "./connext";
import {
  delayAndThrow,
  getDefaultOptions,
  getDefaultStore,
  Logger,
  logTime,
  stringify,
} from "./lib";
import { createMessagingService } from "./messaging";
import { NodeApiClient } from "./node";

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
    logger,
    loggerService,
    logLevel,
  } = opts;
  let { store, messaging, nodeUrl, messagingUrl } = opts;

  const log = loggerService
    ? loggerService.newContext("ConnextConnect")
    : new Logger("ConnextConnect", logLevel, logger);

  // setup ethProvider + network information
  log.debug(`Creating ethereum provider - ethProviderUrl: ${ethProviderUrl}`);
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const network = await ethProvider.getNetwork();

  // setup messaging and node api
  let node: INodeApiClient;
  let config: NodeResponses.GetConfig;

  // setup channelProvider
  let channelProvider: IChannelProvider;
  let isInjected = false;

  // setup signer
  let signer: IChannelSigner;

  if (providedChannelProvider) {
    channelProvider = providedChannelProvider;
    if (typeof channelProvider.config === "undefined") {
      await channelProvider.enable();
    }
    log.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    const getSignature = async (message: string) => {
      const sig = await channelProvider.send(ChannelMethods.chan_signMessage, { message });
      return sig;
    };

    let { userIdentifier, nodeUrl } = channelProvider.config;

    if (!messaging) {
      messaging = await createMessagingService(
        log,
        nodeUrl,
        userIdentifier,
        getSignature,
        messagingUrl,
      );
    } else {
      await messaging.connect();
    }

    // create a new node api instance
    node = new NodeApiClient({
      channelProvider,
      logger: log,
      messaging,
      nodeUrl,
    });
    config = await node.config();

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userIdentifier = userIdentifier;
    node.nodeIdentifier = config.nodeIdentifier;

    isInjected = true;
  } else if (opts.signer) {
    if (!nodeUrl) {
      throw new Error("Client must be instantiated with nodeUrl if not using a channelProvider");
    }

    if (!opts.signer) {
      throw new Error("Client must be instantiated with signer if not using a channelProvider");
    }

    signer = typeof opts.signer === "string" 
      ? new ChannelSigner(opts.signer, ethProvider) 
      : opts.signer;

    store = store || getDefaultStore(opts);

    if (!messaging) {
      messaging = await createMessagingService(
        log,
        nodeUrl,
        signer.publicIdentifier,
        (msg: string) => signer.signMessage(msg),
        messagingUrl,
      );
    } else {
      await messaging.connect();
    }
    // create a new node api instance
    node = new NodeApiClient({ logger: log, messaging, nodeUrl });
    config = await node.config();

    // ensure that node and user identifiers are different
    if (config.nodeIdentifier === signer.publicIdentifier) {
      throw new Error(
        "Client must be instantiated with a signer that is different from the node's",
      );
    }

    channelProvider = await createCFChannelProvider({
      contractAddresses: config.contractAddresses,
      ethProvider,
      lockService: { acquireLock: node.acquireLock.bind(node) },
      logger: log,
      messaging,
      nodeConfig: { STORE_KEY_PREFIX: ConnextClientStorePrefix },
      nodeUrl,
      signer,
      store,
    });
    log.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userIdentifier = channelProvider.config.userIdentifier;
    node.nodeIdentifier = config.nodeIdentifier;
  } else {
    throw new Error("Must provide channelProvider or signer");
  }

  // setup multisigAddress + assign to channelProvider
  const myChannel = await node.getChannel();

  let multisigAddress: string;
  if (!myChannel) {
    log.debug("no channel detected, creating channel..");
    const creationEventData = await Promise.race([
      delayAndThrow(30_000, "Create channel event not fired within 30s"),
      new Promise(
        async (res: any): Promise<any> => {
          channelProvider.once(
            EventNames.CREATE_CHANNEL_EVENT,
            (data: CreateChannelMessage): void => {
              log.debug(`Received CREATE_CHANNEL_EVENT`);
              res(data.data);
            },
          );

          // FYI This continues async in the background after CREATE_CHANNEL_EVENT is recieved
          const creationData = await node.createChannel();
          log.debug(`created channel, transaction: ${stringify(creationData)}`);
        },
      ),
    ]);
    multisigAddress = (creationEventData as MethodResults.CreateChannel).multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }
  log.debug(`multisigAddress: ${multisigAddress}`);

  channelProvider.multisigAddress = multisigAddress;

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
    logger: log,
    messaging: messaging as MessagingService,
    network,
    node,
    signer,
    store,
    token,
  });

  log.debug(`Done creating connext client`);

  // return before any cleanup using the assumption that all injected clients
  // have an online client that it can access that has done the cleanup
  if (isInjected) {
    logTime(log, start, `Client successfully connected`);
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

  log.debug(`Channel is available`);

  // Make sure our store schema is up-to-date
  const schemaVersion = await store.getSchemaVersion();
  if (!schemaVersion || schemaVersion !== STORE_SCHEMA_VERSION) {
    log.debug(`Outdated store schema detected, restoring state`);
    await client.restoreState();
    // increment / update store schema version, defaults to types const
    // of `STORE_SCHEMA_VERSION`
    await client.store.updateSchemaVersion();
  }

  try {
    await client.getFreeBalance();
  } catch (e) {
    if (e.message.includes("StateChannel does not exist yet")) {
      log.debug(`Restoring client state: ${e.stack || e.message}`);
      await client.restoreState();
    } else {
      log.error(`Failed to get free balance: ${e.stack || e.message}`);
      throw e;
    }
  }

  // Make sure our state schema is up-to-date
  const { data: sc } = await client.getStateChannel();
  if (!sc.schemaVersion || sc.schemaVersion !== StateSchemaVersion || !sc.addresses) {
    log.debug("State schema is out-of-date, restoring an up-to-date client state");
    await client.restoreState();
  }

  log.debug("Registering subscriptions");
  await client.registerSubscriptions();

  // cleanup any hanging registry apps
  log.debug("Cleaning up registry apps");
  await client.cleanupRegistryApps();

  // wait for wd verification to reclaim any pending async transfers
  // since if the hub never submits you should not continue interacting
  log.debug("Reclaiming pending async transfers");
  // NOTE: Removing the following await results in a subtle race condition during bot tests.
  //       Don't remove this await again unless you really know what you're doing & bot tests pass
  // no need to await this if it needs collateral
  // TODO: without await causes race conditions in bot, refactor to
  // use events
  try {
    await client.reclaimPendingAsyncTransfers();
  } catch (e) {
    log.error(
      `Could not reclaim pending async transfers: ${e}... will attempt again on next connection`,
    );
  }

  // check in with node to do remaining work
  try {
    await client.clientCheckIn();
  } catch (e) {
    log.error(`Could not complete node check-in: ${e}... will attempt again on next connection`);
  }

  // check in with node to do remaining work
  try {
    const transactions = await client.watchForUserWithdrawal();
    if (transactions.length > 0) {
      console.log(`Found node submitted user withdrawals: ${transactions.map(tx => tx.hash)}`);
    }
  } catch (e) {
    log.error(`Could not complete watching for user withdrawals: ${e.stack || e.message}... will attempt again on next connection`);
  }

  logTime(log, start, `Client successfully connected`);
  return client;
};
