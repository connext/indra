import { ExchangeParameters, ChannelState } from "../types";
import { Logger } from "../lib/logger";
import { Node } from "@counterfactual/node";

// TODO: write exchange cf app!!
export class ExchangeController {

  private log: Logger;
  private cfModule: Node;

  public constructor(cfModule: Node, logLevel?: number) {
    this.cfModule = cfModule;
    this.log = new Logger("ExchangeController", logLevel)
  }

  public async exchange(params: ExchangeParameters): Promise<ChannelState> {
    console.log("Exchange called, yay!")
    return {} as ChannelState
  }
}