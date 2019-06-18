import { TransferParameters, ChannelState } from "../types";
import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  public async transfer(params: TransferParameters): Promise<ChannelState> {
    this.log.info("Transfer called, yay!")
    return {} as ChannelState
  }
}