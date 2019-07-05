import { Node } from "@counterfactual/node";
import { providers } from "ethers";

import { ConnextInternal } from "../connext";
import { Logger } from "../lib/logger";
import { ConnextListener } from "../listener";
import { INodeApiClient } from "../node";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextInternal;
  public log: Logger;
  public node: INodeApiClient;
  public cfModule: Node;
  public listener: ConnextListener;
  public provider: providers.JsonRpcProvider;

  public constructor(name: string, connext: ConnextInternal) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.cfModule = connext.cfModule;
    this.listener = connext.listener;
    this.log = new Logger(name, connext.opts.logLevel);
    this.provider = connext.wallet.provider;
  }
}
