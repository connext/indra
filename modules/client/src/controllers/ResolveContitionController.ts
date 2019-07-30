import { ChannelState, RegisteredAppDetails, ResolveConditionParameters } from "@connext/types";

import { AbstractController } from "./AbstractController";

export class ResolveConditionController extends AbstractController {
  public resolve = async (params: ResolveConditionParameters): Promise<ChannelState> => {
    this.log.info(`resolve called, yay!`);
    return {} as ChannelState;
  };
}
