import { FirebaseServiceFactory } from "@counterfactual/firebase-client";
import {
  CreateChannelMessage,
  MNEMONIC_PATH,
  Node,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, Provider } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { ConfigService } from "../config/config.service";
import { FirebaseProviderId, NodeProviderId } from "../constants";
import { UserService } from "../user/user.service";

const FirebaseServer = require("firebase-server");

@Injectable()
export class NodeWrapper {
  public node: Node;

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
    @Inject(FirebaseProviderId)
    private readonly serviceFactory: FirebaseServiceFactory,
  ) {}

  async createSingleton(): Promise<Node> {
    if (this.node) {
      return this.node;
    }

    console.log("Creating store");
    const store = this.serviceFactory.createStoreService("connextHub");

    console.log("NODE_MNEMONIC: ", this.config.get("NODE_MNEMONIC"));
    await store.set([
      { key: MNEMONIC_PATH, value: this.config.get("NODE_MNEMONIC") },
    ]);

    console.log("Creating Node");
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

    // TODO
    // this.node.on(
    //   NodeTypes.EventName.DEPOSIT_CONFIRMED,
    //   onDepositConfirmed.bind(this),
    // );

    this.node.on(
      NodeTypes.EventName.CREATE_CHANNEL,
      (res: CreateChannelMessage) =>
        this.userService.addMultisig(
          res.data.counterpartyXpub,
          res.data.multisigAddress,
        ),
    );

    console.log("Public Identifier", this.node.publicIdentifier);

    return this.node;
  }
}

export const NodeProvider: Provider = {
  provide: NodeProviderId,
  useFactory: async (
    userService: UserService,
    config: ConfigService,
    firebase: FirebaseServiceFactory,
  ): Promise<Node> => {
    const nodeWrapper = new NodeWrapper(userService, config, firebase);
    return await nodeWrapper.createSingleton();
  },
  inject: [UserService, ConfigService, FirebaseProviderId],
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
