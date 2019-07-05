import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { Contract, ethers } from "ethers";
import { BigNumber } from "ethers/utils";

import { medianizerAbi } from "../abi/medianizer.abi";
import { NatsClientProviderId } from "../constants";
import { CLogger } from "../util";

// mainnet
const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";

const logger = new CLogger("ExchangeRateService");

@Injectable()
export class ExchangeRateService {
  private medianizer: Contract;

  constructor(@Inject(NatsClientProviderId) private readonly natsClient: ClientProxy) {
    const provider = ethers.getDefaultProvider();
    this.medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
  }

  async getExchangeRate(): Promise<BigNumber> {
    return (await this.medianizer.compute())[0];
  }

  async publishRate(): Promise<void> {
    const rate = await this.getExchangeRate();
    logger.log(`Got new rate ${rate}`);
    this.natsClient.send("exchange-rate", rate);
    this.natsClient.emit("exchange-rate", rate);
  }
}
