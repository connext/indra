import { OutcomeType } from "@counterfactual/types";
import { Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryProviderId } from "../constants";
import { CLogger } from "../util";

import { AppRegistryController } from "./appRegistry.controller";
import { AppRegistry, Network } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const defaultApps = [
  {
    actionEncoding: "tuple(uint256 transferAmount, bool finalize)",
    appDefinitionAddress: "0xfDd8b7c07960214C025B74e28733D30cF67A652d",
    name: "EthUnidirectionalTransferApp",
    network: Network.KOVAN,
    outcomeType: OutcomeType.TWO_PARTY_DYNAMIC_OUTCOME,
    stateEncoding: "tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)",
  },
];

const logger = new CLogger("AppRegistryProvider");
// TODO: can we do this a better way?
export const appRegistryProvider: Provider = {
  inject: [AppRegistryRepository],
  provide: AppRegistryProviderId,
  useFactory: async (appRegistryRepository: AppRegistryRepository): Promise<void> => {
    for (const app of defaultApps) {
      if (await appRegistryRepository.findByNameAndNetwork(app.name, app.network)) {
        logger.log(`Default app ${app.name} on ${app.network} already exists in database.`);
        continue;
      }
      logger.log(`Creating new default app ${app.name} on ${app.network}`);
      const appRegistry = new AppRegistry();
      appRegistry.actionEncoding = app.actionEncoding;
      appRegistry.appDefinitionAddress = app.appDefinitionAddress;
      appRegistry.name = app.name;
      appRegistry.network = app.network;
      appRegistry.outcomeType = app.outcomeType;
      appRegistry.stateEncoding = app.stateEncoding;
      await appRegistryRepository.save(appRegistry);
    }
  },
};

@Module({
  controllers: [AppRegistryController],
  exports: [appRegistryProvider],
  imports: [TypeOrmModule.forFeature([AppRegistryRepository])],
  providers: [appRegistryProvider],
})
export class AppRegistryModule {}
