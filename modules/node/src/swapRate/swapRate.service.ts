import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Contract, ethers } from "ethers";
import { AddressZero } from "ethers/constants";
import { BigNumber, parseEther } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";

// mainnet
const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";
// TODO: ganache

@Injectable()
export class SwapRateService {
  private medianizer: Contract;

  constructor(
    private readonly config: ConfigService,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
  ) {
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
  }

  async getSwapRate(): Promise<BigNumber> {
    try {
      return (await this.medianizer.peek())[0];
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        return parseEther("271.8281828"); // e x 100 bc y not
      }
      throw new Error(e);
    }
  }

  async publishRate(): Promise<void> {
    const rate = await this.getSwapRate();
    this.messagingClient
      .emit(`swap-rate.${AddressZero}.${await this.config.getTokenAddress()}`, rate)
      .toPromise();
  }
}
