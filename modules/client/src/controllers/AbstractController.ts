import { providers } from "ethers";

import { ChannelProvider } from "../channelProvider";
import { ConnextClient } from "../connext";
import { CFCore, Logger } from "../lib";
import { ConnextListener } from "../listener";
import { INodeApiClient } from "../node";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextClient;
  public log: Logger;
  public node: INodeApiClient;
  public channelProvider: ChannelProvider;
  public listener: ConnextListener;
  public ethProvider: providers.JsonRpcProvider;

  public constructor(name: string, connext: ConnextClient) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.channelProvider = connext.channelProvider;
    this.listener = connext.listener;
    this.log = new Logger(name, connext.log.logLevel);
    this.ethProvider = connext.ethProvider;
  }
}
