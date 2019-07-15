import { InstallMessage, Node } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { NodeProviderId } from "../constants";
import { CLogger, registerCfNodeListener } from "../util";

import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {}

  private verifyAppInstall(appInstanceId: string) {}

  private registerNodeListeners(): void {
    registerCfNodeListener(
      this.node,
      NodeTypes.EventName.PROPOSE_INSTALL,
      this.verifyAppInstall,
      logger.cxt,
    );
  }

  onModuleInit(): void {
    this.registerNodeListeners();
  }
}
