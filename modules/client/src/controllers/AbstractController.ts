import { providers } from "ethers";

import { ConnextInternal } from "../connext";
import { CFCore } from "../lib/cfCore";
import { Logger } from "../lib/logger";
import { ConnextListener } from "../listener";
import { INodeApiClient } from "../node";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextInternal;
  public log: Logger;
  public node: INodeApiClient;
  public cfCore: CFCore;
  public listener: ConnextListener;
  public ethProvider: providers.JsonRpcProvider;

  public constructor(name: string, connext: ConnextInternal) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.cfCore = connext.cfCore;
    this.listener = connext.listener;
    this.log = new Logger(name, connext.opts.logLevel);
    this.ethProvider = connext.ethProvider;
  }
}
