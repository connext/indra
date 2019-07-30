import { ChannelState, ConditionalTransferParameters, RegisteredAppDetails } from "@connext/types";

import { AbstractController } from "./AbstractController";

export class ConditionalTransferController extends AbstractController {
  public conditionalTransfer = async (
    params: ConditionalTransferParameters,
  ): Promise<ChannelState> => {
    this.log.info(`conditionalTransfer called, yay!`);
    return {} as ChannelState;
  };
}
