import { WithdrawParameters, ChannelState } from "../types";
import { AbstractController } from "./AbstractController";

export class WithdrawalController extends AbstractController {
  public async withdraw(params: WithdrawParameters): Promise<ChannelState> {
    this.log.info("Withdraw called, yay!")
    return {} as ChannelState
  }
}