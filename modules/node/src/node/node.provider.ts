import { IMessagingService, MessagingServiceFactory } from "@connext/messaging";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  InstallMessage,
  InstallVirtualMessage,
  MNEMONIC_PATH,
  Node,
  ProposeMessage,
  ProposeVirtualMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Node as NodeTypes } from "@counterfactual/types";
import { Provider } from "@nestjs/common";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { ethers as eth } from "ethers";

import { ConfigService } from "../config/config.service";
import { MessagingProviderId, NodeProviderId, PostgresProviderId } from "../constants";
import { CLogger, registerCfNodeListener } from "../util";

const logger = new CLogger("NodeProvider");

type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: any) => Promise<any> | void;
};

async function createNode(
  config: ConfigService,
  messagingService: IMessagingService,
  postgresServiceFactory: PostgresServiceFactory,
): Promise<Node> {
  logger.log("Creating store");
  const store = postgresServiceFactory.createStoreService("connextHub");
  logger.log("Store created");

  logger.log(`Creating Node with mnemonic: ${config.getMnemonic()}`);
  await store.set([{ key: MNEMONIC_PATH, value: config.getMnemonic() }]);

  // test that provider works
  const { chainId, name: networkName } = await config.getEthNetwork();
  const addr = eth.Wallet.fromMnemonic(config.getMnemonic(), "m/44'/60'/0'/25446").address;
  const provider = config.getEthProvider();
  const balance = (await provider.getBalance(addr)).toString();
  logger.log(
    `Balance of signer address ${addr} on ${networkName} (chainId ${chainId}): ${balance}`,
  );
  const node = await Node.create(
    messagingService,
    store,
    { STORE_KEY_PREFIX: "store" },
    provider,
    await config.getContractAddresses(),
  );
  logger.log("Node created");
  logger.log(`Public Identifier ${JSON.stringify(node.publicIdentifier)}`);
  logger.log(
    `Free balance address ${JSON.stringify(
      eth.utils.HDNode.fromExtendedKey(node.publicIdentifier).derivePath("0").address,
    )}`,
  );

  registerDefaultCfListeners(node);

  return node;
}

function logEvent(event: NodeTypes.EventName, res: NodeTypes.NodeMessage & { data: any }): void {
  logger.log(
    `${event} event fired from ${res && res.from ? res.from : null}, data: ${JSON.stringify(
      res.data,
    )}`,
  );
}

function registerDefaultCfListeners(node: Node): void {
  Object.entries(defaultCallbacks).forEach(
    ([event, callback]: [NodeTypes.EventName, () => any]): void => {
      registerCfNodeListener(node, event, callback, "DefaultListener");
    },
  );
}

const defaultCallbacks: CallbackStruct = {
  COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
    logEvent(NodeTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data);
  },
  CREATE_CHANNEL: async (data: CreateChannelMessage): Promise<void> => {
    logEvent(NodeTypes.EventName.CREATE_CHANNEL, data);
  },
  DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
    logEvent(NodeTypes.EventName.DEPOSIT_CONFIRMED, data);
  },
  DEPOSIT_FAILED: (data: any): void => {
    logEvent(NodeTypes.EventName.DEPOSIT_FAILED, data);
  },
  DEPOSIT_STARTED: (data: any): void => {
    logEvent(NodeTypes.EventName.DEPOSIT_STARTED, data);
  },
  INSTALL: (data: InstallMessage): void => {
    logEvent(NodeTypes.EventName.INSTALL, data);
  },
  // TODO: make cf return app instance id and app def?
  INSTALL_VIRTUAL: (data: InstallVirtualMessage): void => {
    logEvent(NodeTypes.EventName.INSTALL_VIRTUAL, data);
  },
  PROPOSE_INSTALL: (data: ProposeMessage): void => {
    logEvent(NodeTypes.EventName.PROPOSE_INSTALL, data);
  },
  PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
    logEvent(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data);
  },
  PROPOSE_STATE: (data: any): void => {
    // TODO: need to validate all apps here as well?
    logEvent(NodeTypes.EventName.PROPOSE_STATE, data);
  },
  PROTOCOL_MESSAGE_EVENT: (data: any): void => {
    logEvent(NodeTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
  },
  REJECT_INSTALL: (data: any): void => {
    logEvent(NodeTypes.EventName.REJECT_INSTALL, data);
  },
  REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
    logEvent(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, data);
  },
  REJECT_STATE: (data: any): void => {
    logEvent(NodeTypes.EventName.REJECT_STATE, data);
  },
  UNINSTALL: (data: UninstallMessage): void => {
    logEvent(NodeTypes.EventName.UNINSTALL, data);
  },
  UNINSTALL_VIRTUAL: (data: UninstallVirtualMessage): void => {
    logEvent(NodeTypes.EventName.UNINSTALL_VIRTUAL, data);
  },
  UPDATE_STATE: (data: UpdateStateMessage): void => {
    logEvent(NodeTypes.EventName.UPDATE_STATE, data);
  },
  WITHDRAW_EVENT: (data: any): void => {
    logEvent(NodeTypes.EventName.WITHDRAW_EVENT, data);
  },
  WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
    logEvent(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, data);
  },
  WITHDRAWAL_FAILED: (data: any): void => {
    logEvent(NodeTypes.EventName.WITHDRAWAL_FAILED, data);
  },
  WITHDRAWAL_STARTED: (data: any): void => {
    logEvent(NodeTypes.EventName.WITHDRAWAL_STARTED, data);
  },
};

export const nodeProvider: Provider = {
  inject: [ConfigService, MessagingProviderId, PostgresProviderId],
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    messaging: IMessagingService,
    postgres: PostgresServiceFactory,
  ): Promise<Node> => {
    return await createNode(config, messaging, postgres);
  },
};

// TODO: bypass factory
export const postgresProvider: Provider = {
  inject: [ConfigService],
  provide: PostgresProviderId,
  useFactory: async (config: ConfigService): Promise<PostgresServiceFactory> => {
    const pg = new PostgresServiceFactory({
      ...config.getPostgresConfig(),
      type: "postgres",
    });
    await pg.connectDb();
    return pg;
  },
};

// TODO: bypass factory
export const messagingProvider: FactoryProvider<Promise<IMessagingService>> = {
  inject: [ConfigService],
  provide: MessagingProviderId,
  useFactory: async (config: ConfigService): Promise<IMessagingService> => {
    const messagingFactory = new MessagingServiceFactory(config.getMessagingConfig());
    const messagingService = messagingFactory.createService("messaging");
    await messagingService.connect();
    return messagingService;
  },
};
