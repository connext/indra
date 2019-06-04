import { FirebaseServiceFactory } from "@counterfactual/firebase-client";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  MNEMONIC_PATH,
  Node,
} from "@counterfactual/node";
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
import { FirebaseProviderId, NodeProviderId } from "../constants";
import { UserService } from "../user/user.service";

const FirebaseServer = require("firebase-server");

@Injectable()
export class NodeWrapper {
  public node: Node;

  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
    private readonly config: ConfigService,
    @Inject(FirebaseProviderId)
    private readonly serviceFactory: FirebaseServiceFactory,
  ) {}

  async createSingleton(): Promise<Node> {
    if (this.node) {
      return this.node;
    }

    // TODO: make this logging more dynamic?
    Logger.log("Creating store", "NodeProvider");
    const store = this.serviceFactory.createStoreService("connextHub");
    Logger.log("Store created", "NodeProvider");

    await store.set([
      { key: MNEMONIC_PATH, value: this.config.nodeMnemonic() },
    ]);

    Logger.log("Creating Node", "NodeProvider");
    const messService = this.serviceFactory.createMessagingService("messaging");
    this.node = await Node.create(
      messService,
      store,
      {
        STORE_KEY_PREFIX: "store",
      },
      new JsonRpcProvider("https://rinkeby.infura.io/metamask", "rinkeby"),
      "rinkeby",
    );
    Logger.log("Node created", "NodeProvider");

    this.node.on(
      NodeTypes.EventName.DEPOSIT_CONFIRMED,
      (res: DepositConfirmationMessage) => {
        if (!res || !res.data) {
          return;
        }
        Logger.log(`Deposit detected: ${res}, matching`, "NodeProvider");
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
  provide: NodeProviderId,
  useFactory: async (
    userService: UserService,
    channelService: ChannelService,
    config: ConfigService,
    firebase: FirebaseServiceFactory,
  ): Promise<Node> => {
    const nodeWrapper = new NodeWrapper(
      userService,
      channelService,
      config,
      firebase,
    );
    return await nodeWrapper.createSingleton();
  },
  inject: [UserService, ChannelService, ConfigService, FirebaseProviderId],
};

export const FirebaseProvider: Provider = {
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
      projectId: "projectId",
      storageBucket: "",
      messagingSenderId: "",
    });
  },
  inject: [ConfigService],
};
