import { WithdrawParameters, ChannelState } from "../types";
import { Logger } from "../lib/logger";
import { Node } from "@counterfactual/node";

export class WithdrawalController {

  private log: Logger;
  private cfModule: Node;

  public constructor(cfModule: Node, logLevel?: number) {
    this.cfModule = cfModule;
    this.log = new Logger("WithdrawalController", logLevel)
  }

  public async withdraw(params: WithdrawParameters): Promise<ChannelState> {
    this.log.info("Withdraw called, yay!")
    return {} as ChannelState
  }
}