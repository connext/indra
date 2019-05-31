import {
  FirebaseServiceFactory,
  MNEMONIC_PATH,
  Node,
} from "@counterfactual/node";
import { Inject, Injectable, Provider } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { ConfigService } from "../config/config.service";
import { FirebaseProviderId, NodeProviderId } from "../constants";

const FirebaseServer = require("firebase-server");

@Injectable()
export class NodeWrapper {
  public node: Node;

  constructor(
    private readonly config: ConfigService,
    @Inject("FIREBASE") private readonly serviceFactory: FirebaseServiceFactory,
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
      new JsonRpcProvider(this.config.get("ETH_RPC_URL")),
      "rinkeby",
    );

    console.log("Public Identifier", this.node.publicIdentifier);

    return this.node;
  }
}

export const NodeProvider: Provider = {
  provide: NodeProviderId,
  useFactory: async (
    config: ConfigService,
    firebase: FirebaseServiceFactory,
  ): Promise<Node> => {
    const nodeWrapper = new NodeWrapper(config, firebase);
    return await nodeWrapper.createSingleton();
  },
  inject: [ConfigService, FirebaseProviderId],
};

export const FirebaseProvider: Provider = {
  provide: FirebaseProviderId,
  useFactory: (config: ConfigService): FirebaseServiceFactory => {
    const firebaseServerHost = config.get("FIREBASE_SERVER_HOST");
    const firebaseServerPort = config.get("FIREBASE_SERVER_PORT");
    const firebase = new FirebaseServer(firebaseServerPort, firebaseServerPort);
    process.on("SIGINT", () => {
      console.log("Shutting down indra hub...");
      firebase.close();
      process.exit(0);
    });
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
