import { TransferParameters, ChannelState } from "../types";
import { Logger } from "../lib/logger";
import { Node } from "@counterfactual/node";

export class TransferController {

  private log: Logger;
  private cfModule: Node;

  public constructor(cfModule: Node, logLevel?: number) {
    this.cfModule = cfModule;
    this.log = new Logger("TransferController", logLevel)
  }

  public async transfer(params: TransferParameters): Promise<ChannelState> {
    console.log("Transfer called, yay!")
    return {} as ChannelState
  }
}