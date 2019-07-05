import { FactoryProvider } from "@nestjs/common/interfaces";
import { Contract, ethers } from "ethers";
import { BigNumber } from "ethers/utils";
import interval from "interval-promise";

import { medianizerAbi } from "../abi/medianizer.abi";
import { ExchangeRateProviderId } from "../constants";
import { CLogger } from "../util";

import { ExchangeRateService } from "./exchangeRate.service";

// mainnet
const MEDIANIZER_ADDRESS = "0x729D19f657BD0614b4985Cf1D82531c67569197B";
// TODO: handle on ganache?

const logger = new CLogger("exchangeRateProvider");

// async function getExchangeRate(medianizer: Contract): Promise<BigNumber> {
//   return (await medianizer.compute())[0];
// }

// export const exchangeRateProvider: FactoryProvider = {
//   inject: [NatsClientProviderId],
//   provide: ExchangeRateProviderId,
//   useFactory: (natsClient: ClientProxy): void => {
//     const provider = ethers.getDefaultProvider();
//     const medianizer = new ethers.Contract(MEDIANIZER_ADDRESS, medianizerAbi, provider);
//     interval(async () => {
//       const rate = await getExchangeRate(medianizer);
//       logger.log(`Got new rate ${rate}`);
//       natsClient.send("exchange-rate", rate);
//       natsClient.emit("exchange-rate", rate);
//     }, 5000);
//   },
// };

export const exchangeRateProvider: FactoryProvider = {
  inject: [ExchangeRateService],
  provide: ExchangeRateProviderId,
  useFactory: (exchangeRateService: ExchangeRateService): void => {
    interval(async () => {
      await exchangeRateService.publishRate();
    }, 5000);
  },
};
