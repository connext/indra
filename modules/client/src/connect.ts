import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import { CF_PATH, CREATE_CHANNEL_EVENT, StateSchemaVersion } from "@connext/types";
import "core-js/stable";
import { Contract, providers } from "ethers";
import { AddressZero } from "ethers/constants";
import { fromExtendedKey, fromMnemonic } from "ethers/utils/hdnode";
import tokenAbi from "human-standard-token-abi";
import "regenerator-runtime/runtime";

import { createCFChannelProvider } from "./channelProvider";
import { ConnextClient } from "./connext";
import { getDefaultOptions, isWalletProvided, getDefaultStore } from "./lib/default";
import { delayAndThrow, Logger, stringify } from "./lib";
import { NodeApiClient } from "./node";
import {
  CFCoreTypes,
  ClientOptions,
  ConnextClientStorePrefix,
  CreateChannelMessage,
  GetConfigResponse,
  IChannelProvider,
  IConnextClient,
  INodeApiClient,
} from "./types";

const exists = (obj: any): boolean => {
  return !!obj && !!Object.keys(obj).length;
};

const createMessagingService = async (
  messagingUrl: string,
  logLevel: number,
): Promise<IMessagingService> => {
  // create a messaging service client
  const messagingFactory = new MessagingServiceFactory({ logLevel, messagingUrl });
  const messaging = messagingFactory.createService("messaging");
  await messaging.connect();
  return messaging;
};

const setupMultisigAddress = async (
  node: INodeApiClient,
  channelProvider: IChannelProvider,
  log: Logger,
): Promise<IChannelProvider> => {
  const myChannel = await node.getChannel();

  let multisigAddress: string;
  if (!myChannel) {
    log.debug("no channel detected, creating channel..");
    const creationEventData = await Promise.race([
      delayAndThrow(30_000, "Create channel event not fired within 30s"),
      new Promise(
        async (res: any): Promise<any> => {
          channelProvider.once(CREATE_CHANNEL_EVENT, (data: CreateChannelMessage): void => {
            res(data.data);
          });

          const creationData = await node.createChannel();
          log.debug(`created channel, transaction: ${stringify(creationData)}`);
        },
      ),
    ]);
    multisigAddress = (creationEventData as CFCoreTypes.CreateChannelResult).multisigAddress;
  } else {
    multisigAddress = myChannel.multisigAddress;
  }
  log.debug(`multisigAddress: ${multisigAddress}`);

  channelProvider.multisigAddress = multisigAddress;
  return channelProvider;
};

export const connect = async (
  clientOptions: string | ClientOptions,
  overrideOptions?: Partial<ClientOptions>,
): Promise<IConnextClient> => {
  const opts =
    typeof clientOptions === "string"
      ? await getDefaultOptions(clientOptions, overrideOptions)
      : clientOptions;
  const {
    logLevel,
    ethProviderUrl,
    nodeUrl,
    mnemonic,
    channelProvider: providedChannelProvider,
  } = opts;
  let { xpub, keyGen, store, messaging } = opts;

  const log = new Logger("ConnextConnect", logLevel);

  // setup ethProvider + network information
  log.debug(`Creating ethereum provider - ethProviderUrl: ${ethProviderUrl}`);
  const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);
  const network = await ethProvider.getNetwork();

  // setup messaging and node api
  let node: INodeApiClient;
  let config: GetConfigResponse;

  // setup channelProvider
  let channelProvider: IChannelProvider;
  let isInjected = false;

  if (providedChannelProvider) {
    channelProvider = providedChannelProvider;
    if (!exists(channelProvider.config)) {
      await channelProvider.enable();
    }
    log.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    log.debug(`Creating messaging service client ${channelProvider.config.nodeUrl}`);
    if (!messaging) {
      messaging = await createMessagingService(channelProvider.config.nodeUrl, logLevel);
    } else {
      await messaging.connect();
    }

    // create a new node api instance
    node = new NodeApiClient({ logLevel, messaging, channelProvider });
    config = await node.config();
    log.debug(`Node provided config: ${stringify(config)}`);

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userPublicIdentifier = channelProvider.config.userPublicIdentifier;
    node.nodePublicIdentifier = config.nodePublicIdentifier;

    isInjected = true;
  } else if (isWalletProvided(opts)) {
    if (!nodeUrl) {
      throw new Error("Client must be instantiated with nodeUrl if not using a channelProvider");
    }

    if (!store) {
      store = getDefaultStore(opts);
    }

    if (mnemonic) {
      log.debug(`Creating channelProvider with mnemonic: ${mnemonic}`);
      // Convert mnemonic into xpub + keyGen if provided
      const hdNode = fromExtendedKey(fromMnemonic(mnemonic).extendedKey).derivePath(CF_PATH);
      xpub = hdNode.neuter().extendedKey;
      keyGen = (index: string): Promise<string> =>
        Promise.resolve(hdNode.derivePath(index).privateKey);
    } else {
      log.debug(`Creating channelProvider with xpub: ${xpub}`);
      log.debug(`Creating channelProvider with keyGen: ${keyGen}`);
    }

    log.debug(`Creating messaging service client ${nodeUrl}`);
    if (!messaging) {
      messaging = await createMessagingService(nodeUrl, logLevel);
    } else {
      await messaging.connect();
    }

    // create a new node api instance
    node = new NodeApiClient({ logLevel, messaging });
    config = await node.config();
    log.debug(`Node provided config: ${stringify(config)}`);

    // ensure that node and user xpub are different
    if (config.nodePublicIdentifier === xpub) {
      throw new Error(
        "Client must be instantiated with a mnemonic that is different from the node's mnemonic",
      );
    }

    channelProvider = await createCFChannelProvider({
      ethProvider,
      keyGen,
      lockService: { acquireLock: node.acquireLock.bind(node) },
      messaging: messaging as any,
      networkContext: config.contractAddresses,
      nodeConfig: { STORE_KEY_PREFIX: ConnextClientStorePrefix },
      nodeUrl,
      store,
      xpub,
    });

    log.debug(`Using channelProvider config: ${stringify(channelProvider.config)}`);

    // set pubids + channelProvider
    node.channelProvider = channelProvider;
    node.userPublicIdentifier = channelProvider.config.userPublicIdentifier;
    node.nodePublicIdentifier = config.nodePublicIdentifier;
  } else {
    throw new Error("Must provide mnemonic or xpub + keygen");
  }

  // setup multisigAddress + assign to channelProvider
  await setupMultisigAddress(node, channelProvider, log);

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
    keyGen,
    messaging,
    network,
    node,
    store,
    token,
    ...opts, // use any provided opts by default
  });

  // return before any cleanup using the assumption that all injected clients
  // have an online client that it can access that has don the cleanup
  if (isInjected) {
    return client;
  }

  // waits until the setup protocol or create channel call is completed
  console.error("waiting for channel to be available...");
  await new Promise(
    async (resolve: any, reject: any): Promise<any> => {
      // Wait for channel to be available
      const channelIsAvailable = async (): Promise<boolean> => {
        const chan = await node.getChannel();
        return chan && chan.available;
      };
      while (!(await channelIsAvailable())) {
        await new Promise((res: any): any => setTimeout((): void => res(), 100));
      }
      resolve();
    },
  );
  console.error("channel is available!");

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
  await client.cleanupRegistryApps();

  // check if there is a coin refund app installed for eth and tokens
  await client.uninstallCoinBalanceIfNeeded(AddressZero);
  await client.uninstallCoinBalanceIfNeeded(config.contractAddresses.Token);

  // make sure there is not an active withdrawal with >= MAX_WITHDRAWAL_RETRIES
  log.debug("Resubmitting active withdrawals");
  await client.resubmitActiveWithdrawal();

  // wait for wd verification to reclaim any pending async transfers
  // since if the hub never submits you should not continue interacting
  log.debug("Reclaiming pending async transfers");
  // NOTE: Removing the following await results in a subtle race condition during bot tests.
  //       Don't remove this await again unless you really know what you're doing & bot tests pass
  // no need to await this if it needs collateral
  // TODO: without await causes race conditions in bot, refactor to
  // use events
  await client.reclaimPendingAsyncTransfers();

  // check in with node to do remaining work
  await client.clientCheckIn();

  // check if client is available
  await client.isAvailable();

  log.debug("Done creating channel client");

  return client;
};
