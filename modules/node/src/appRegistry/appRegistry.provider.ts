import { Provider } from "@nestjs/common";

import { ConfigService } from "../config/config.service";
import { AppRegistryProviderId } from "../constants";
import { CLogger } from "../util";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryProvider");

// This thing's only responsibility is to save apps to the db
// Is there an better way to do this? Maybe as part of onModuleInit?
export const appRegistryProviderFactory: Provider = {
  inject: [AppRegistryRepository, ConfigService],
  provide: AppRegistryProviderId,
  useFactory: async (
    appRegistryRepository: AppRegistryRepository,
    configService: ConfigService,
  ): Promise<void> => {
    for (const app of await configService.getDefaultApps()) {
      let appRegistry = await appRegistryRepository.findByNameAndNetwork(app.name, app.network);
      if (!appRegistry) {
        appRegistry = new AppRegistry();
      }
      logger.log(`Creating app ${app.name} on ${app.network} at: ${app.appDefinitionAddress}`);
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
