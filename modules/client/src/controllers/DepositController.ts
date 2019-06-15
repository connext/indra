import { DepositParameters, ChannelState } from "../types";
import { Logger } from "../lib/logger";
import { Node } from "@counterfactual/node";

export class DepositController {

  private log: Logger;
  private cfModule: Node;

  public constructor(cfModule: Node, logLevel?: number) {
    this.cfModule = cfModule;
    this.log = new Logger("DepositController", logLevel)
  }

  public async deposit(params: DepositParameters): Promise<ChannelState> {
    this.log.info("Deposit called, yay!")
    return {} as ChannelState
  }
}