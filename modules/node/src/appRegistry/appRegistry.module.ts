import { OutcomeType } from "@counterfactual/types";
import { Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { AppRegistryProviderId } from "../constants";
import { NodeModule } from "../node/node.module";
import { CLogger } from "../util";

import { AppRegistryController } from "./appRegistry.controller";
import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

const logger = new CLogger("AppRegistryProvider");
// TODO: can we do this a better way?
export const appRegistryProvider: Provider = {
  inject: [AppRegistryRepository, ConfigService],
  provide: AppRegistryProviderId,
  useFactory: async (
    appRegistryRepository: AppRegistryRepository,
    configService: ConfigService,
  ): Promise<void> => {
    for (const app of configService.getDefaultApps()) {
      let appRegistry = await appRegistryRepository.findByNameAndNetwork(app.name, app.network);
      if (!appRegistry) {
        appRegistry = new AppRegistry();
      }
      logger.log(`Creating default app ${app.name} on ${app.network}`);
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
  imports: [ConfigModule, TypeOrmModule.forFeature([AppRegistryRepository]), NodeModule],
  providers: [appRegistryProvider, AppRegistryService],
})
export class AppRegistryModule {}
