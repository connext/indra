import { FirebaseServiceFactory } from "@counterfactual/firebase-client";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  MNEMONIC_PATH,
  Node,
} from "@counterfactual/node";
import { PostgresServiceFactory } from "@counterfactual/postgresql-node-connector";
import { Node as NodeTypes } from "@counterfactual/types";
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  Provider,
} from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { NatsServiceFactory } from "../../../monorepo/packages/nats-messaging-client/src/index";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import {
  FirebaseProviderId,
  NatsProviderId,
  NodeProviderId,
  PostgresProviderId,
} from "../constants";
import { UserService } from "../user/user.service";

async function createNode(
  channelService: ChannelService,
  config: ConfigService,
  firebaseServiceFactory: FirebaseServiceFactory,
  natsServiceFactory: NatsServiceFactory,
  postgresServiceFactory: PostgresServiceFactory,
  userService: UserService,
): Promise<Node> {
  // TODO: make this logging more dynamic?
  Logger.log("Creating store", "NodeProvider");
  // const store = this.firebaseServiceFactory.createStoreService("connextHub");
  const store = postgresServiceFactory.createStoreService("connextHub");
  Logger.log("Store created", "NodeProvider");

  await store.set([{ key: MNEMONIC_PATH, value: config.getNodeMnemonic() }]);

  Logger.log("Creating Node", "NodeProvider");
  // const messService = firebaseServiceFactory.createMessagingService(
  //   "messaging",
  // );
  const messService = natsServiceFactory.createMessagingService("messaging");
  const node = await Node.create(
    messService,
    store,
    {
      STORE_KEY_PREFIX: "store",
    },
    new JsonRpcProvider("https://kovan.infura.io/metamask") as any, // FIXME
    "kovan",
  );
  Logger.log("Node created", "NodeProvider");

  node.on(
    NodeTypes.EventName.DEPOSIT_CONFIRMED,
    (res: DepositConfirmationMessage) => {
      if (!res || !res.data) {
        return;
      }
      Logger.log(
        `Deposit detected: ${JSON.stringify(res)}, matching`,
        "NodeProvider",
      );
      channelService.deposit(
        res.data.multisigAddress,
        res.data.amount as any, // FIXME
        res.data.notifyCounterparty,
      );
    },
  );

  node.on(NodeTypes.EventName.CREATE_CHANNEL, (res: CreateChannelMessage) =>
    userService.addMultisig(
      res.data.counterpartyXpub,
      res.data.multisigAddress,
    ),
  );

  Logger.log(
    `Public Identifier ${JSON.stringify(node.publicIdentifier)}`,
    "NodeProvider",
  );

  return node;
}

export const NodeProvider: Provider = {
  inject: [
    ChannelService,
    ConfigService,
    FirebaseProviderId,
    NatsProviderId,
    PostgresProviderId,
    UserService,
  ],
  provide: NodeProviderId,
  useFactory: async (
    channelService: ChannelService,
    config: ConfigService,
    firebase: FirebaseServiceFactory,
    nats: NatsServiceFactory,
    postgres: PostgresServiceFactory,
    userService: UserService,
  ): Promise<Node> => {
    return await createNode(
      channelService,
      config,
      firebase,
      nats,
      postgres,
      userService,
    );
  },
};

export const FirebaseProvider: Provider = {
  inject: [ConfigService],
  provide: FirebaseProviderId,
  useFactory: (config: ConfigService): FirebaseServiceFactory => {
    const firebaseServerHost = config.get("FIREBASE_SERVER_HOST");
    const firebaseServerPort = config.get("FIREBASE_SERVER_PORT");
    // const firebase = new FirebaseServer(firebaseServerHost, firebaseServerPort);
    // process.on("SIGINT", () => {
    //   console.log("Shutting down indra hub...");
    //   firebase.close();
    //   process.exit(0);
    // });
    return new FirebaseServiceFactory({
      apiKey: "",
      authDomain: "",
      databaseURL: `ws://${firebaseServerHost}:${firebaseServerPort}`,
      messagingSenderId: "",
      projectId: "projectId",
      storageBucket: "",
    });
  },
};

export const PostgresProvider: Provider = {
  inject: [ConfigService],
  provide: PostgresProviderId,
  useFactory: async (
    config: ConfigService,
  ): Promise<PostgresServiceFactory> => {
    const pg = new PostgresServiceFactory({
      ...config.getPostgresConfig(),
      type: "postgres",
    });
    await pg.connectDb();
    return pg;
  },
};

export const NatsProvider: Provider = {
  inject: [ConfigService],
  provide: NatsProviderId,
  useFactory: async (config: ConfigService): Promise<NatsServiceFactory> => {
    const nats = new NatsServiceFactory(config.getNatsConfig());
    await nats.connect();
    return nats;
  },
};
