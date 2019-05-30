import {
  FirebaseServiceFactory,
  MNEMONIC_PATH,
  Node
} from "@counterfactual/node";
import { Injectable, Provider } from "@nestjs/common";
import { JsonRpcProvider } from "ethers/providers";

import { ConfigService } from "../config/config.service";

const FirebaseServer = require("firebase-server");

@Injectable()
export class NodeWrapper {
  constructor(private readonly config: ConfigService) {}

  async create() {
    const firebaseServerHost = this.config.get("FIREBASE_SERVER_HOST");
    const firebaseServerPort = this.config.get("FIREBASE_SERVER_PORT");
    new FirebaseServer(firebaseServerPort, firebaseServerHost);
    const serviceFactory = new FirebaseServiceFactory({
      apiKey: "",
      authDomain: "",
      databaseURL: `ws://${firebaseServerHost}:${firebaseServerPort}`,
      projectId: "",
      storageBucket: "",
      messagingSenderId: ""
    });

    console.log("Creating store");
    const store = serviceFactory.createStoreService("connextHub");

    console.log("NODE_MNEMONIC: ", this.config.get("NODE_MNEMONIC"));
    await store.set([
      { key: MNEMONIC_PATH, value: this.config.get("NODE_MNEMONIC") }
    ]);

    console.log("Creating Node");
    const messService = serviceFactory.createMessagingService("messaging");
    const node = await Node.create(
      messService,
      store,
      {
        STORE_KEY_PREFIX: "store"
      },
      new JsonRpcProvider(this.config.get("ETH_RPC_URL")),
      "rinkeby"
    );

    console.log("Public Identifier", node.publicIdentifier);

    return node;
  }
}

export const NodeProvider: Provider = {
  provide: "NODE",
  useFactory: async (config: ConfigService) => {
    const node = new NodeWrapper(config);
    return await node.create();
  },
  inject: [ConfigService]
};
