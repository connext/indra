import { ChannelState, ExchangeParameters } from "@connext/types";

import { AbstractController } from "./AbstractController";

// TODO: write exchange cf app!!
export class ExchangeController extends AbstractController {
  public async exchange(params: ExchangeParameters): Promise<ChannelState> {
    this.log.info("Exchange called, yay!");
    return {} as ChannelState;
  }
}
