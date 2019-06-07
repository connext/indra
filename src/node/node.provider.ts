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

import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import {
  FirebaseProviderId,
  NodeProviderId,
  PostgresProviderId,
} from "../constants";
import { UserService } from "../user/user.service";

@Injectable()
export class NodeWrapper {
  public node: Node;

  constructor(
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
    private readonly config: ConfigService,
    @Inject(FirebaseProviderId)
    private readonly firebaseServiceFactory: FirebaseServiceFactory,
    @Inject(PostgresProviderId)
    private readonly postgresServiceFactory: PostgresServiceFactory,
    private readonly userService: UserService,
  ) {}

  async createSingleton(): Promise<Node> {
    if (this.node) {
      return this.node;
    }

    // TODO: make this logging more dynamic?
    Logger.log("Creating store", "NodeProvider");
    // const store = this.firebaseServiceFactory.createStoreService("connextHub");
    const store = this.postgresServiceFactory.createStoreService("connextHub");
    Logger.log("Store created", "NodeProvider");

    await store.set([
      { key: MNEMONIC_PATH, value: this.config.nodeMnemonic() },
    ]);

    Logger.log("Creating Node", "NodeProvider");
    const messService = this.firebaseServiceFactory.createMessagingService(
      "messaging",
    );
    this.node = await Node.create(
      messService,
      store,
      {
        STORE_KEY_PREFIX: "store",
      },
      new JsonRpcProvider("https://kovan.infura.io/metamask", "kovan"),
      "kovan",
    );
    Logger.log("Node created", "NodeProvider");

    this.node.on(
      NodeTypes.EventName.DEPOSIT_CONFIRMED,
      (res: DepositConfirmationMessage) => {
        if (!res || !res.data) {
          return;
        }
        Logger.log(
          `Deposit detected: ${JSON.stringify(res)}, matching`,
          "NodeProvider",
        );
        this.channelService.deposit(
          res.data.multisigAddress,
          res.data.amount,
          res.data.notifyCounterparty,
        );
      },
    );

    this.node.on(
      NodeTypes.EventName.CREATE_CHANNEL,
      (res: CreateChannelMessage) =>
        this.userService.addMultisig(
          res.data.counterpartyXpub,
          res.data.multisigAddress,
        ),
    );

    Logger.log(
      `Public Identifier ${JSON.stringify(this.node.publicIdentifier)}`,
      "NodeProvider",
    );

    return this.node;
  }
}

export const NodeProvider: Provider = {
  inject: [
    ChannelService,
    ConfigService,
    FirebaseProviderId,
    PostgresProviderId,
    UserService,
  ],
  provide: NodeProviderId,
  useFactory: async (
    channelService: ChannelService,
    config: ConfigService,
    firebase: FirebaseServiceFactory,
    postgres: PostgresServiceFactory,
    userService: UserService,
  ): Promise<Node> => {
    const nodeWrapper = new NodeWrapper(
      channelService,
      config,
      firebase,
      postgres,
      userService,
    );
    return await nodeWrapper.createSingleton();
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
      ...config.postgresConfig(),
      type: "postgres",
    });
    await pg.connectDb();
    return pg;
  },
};
