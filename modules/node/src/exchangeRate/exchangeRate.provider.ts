import { FactoryProvider } from "@nestjs/common/interfaces";
import { ClientProxy } from "@nestjs/microservices";
import { Contract, ethers } from "ethers";

import { medianizerAbi } from "../abi/medianizer.abi";
import { MedianizerProviderId, NatsClientProviderId } from "../constants";

const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";

async function getExchangeRate(medianizer: Contract) {
  return (await medianizer.compute())[0];
}

export const exchangeRateProvider: FactoryProvider = {
  inject: [NatsClientProviderId],
  provide: NatsClientProviderId,
  useFactory: (natsClient: ClientProxy): any => {
    // add interval promise
  },
};

export const medianizerProvider: FactoryProvider = {
  provide: MedianizerProviderId,
  useFactory: (): Contract => {
    const provider = ethers.getDefaultProvider();
    return new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
  },
};
