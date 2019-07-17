import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Contract, ethers } from "ethers";
import { BigNumber } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { NatsClientProviderId } from "../constants";

// mainnet
const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";
// TODO: ganache

@Injectable()
export class SwapRateService {
  private medianizer: Contract;

  constructor(@Inject(NatsClientProviderId) private readonly natsClient: ClientProxy) {
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
  }

  async getSwapRate(): Promise<BigNumber> {
    return (await this.medianizer.compute())[0];
  }

  async publishRate(): Promise<void> {
    const rate = await this.getSwapRate();
    // TODO this will have to be changed to actual addresses
    this.natsClient.emit("swap-rate.eth.dai", rate).toPromise();
  }
}
