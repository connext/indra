import { ChannelState, SwapParameters } from "@connext/types";

import { AbstractController } from "./AbstractController";

export class SwapController extends AbstractController {
  public async swap(params: SwapParameters): Promise<ChannelState> {
    this.log.info("Swap called, yay!");
    return {} as ChannelState;
  }
}
