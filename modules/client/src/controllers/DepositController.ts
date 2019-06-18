import { DepositParameters, ChannelState } from "../types";
import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {

  public async deposit(params: DepositParameters): Promise<ChannelState> {
    this.log.info("Deposit called, yay!")
    // deposit into the multisig

    return {} as ChannelState
  }
}