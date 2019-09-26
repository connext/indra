import { providers } from "ethers";

import { ChannelRouter } from "../channelRouter";
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
  public channelRouter: ChannelRouter;
  public listener: ConnextListener;
  public ethProvider: providers.JsonRpcProvider;

  public constructor(name: string, connext: ConnextInternal) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.channelRouter = connext.channelRouter;
    this.listener = connext.listener;
    this.log = new Logger(name, connext.opts.logLevel);
    this.ethProvider = connext.ethProvider;
  }
}
