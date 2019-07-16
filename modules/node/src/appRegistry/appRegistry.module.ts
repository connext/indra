import { OutcomeType } from "@counterfactual/types";
import { Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryProviderId } from "../constants";
import { NodeModule } from "../node/node.module";
import { CLogger } from "../util";

import { AppRegistryController } from "./appRegistry.controller";
import { AppRegistry, Network } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";
import { AppRegistryService } from "./appRegistry.service";

type DefaultApp = {
  actionEncoding?: string;
  allowNodeInstall: boolean;
  appDefinitionAddress: string;
  name: string;
  network: Network;
  outcomeType: OutcomeType;
  stateEncoding: string;
};

export enum KnownNodeAppNames {
  SIMPLE_TWO_PARTY_SWAP = "SimpleTwoPartySwapApp",
}

const defaultApps: DefaultApp[] = [
  {
    actionEncoding: "tuple(uint256 transferAmount, bool finalize)",
    allowNodeInstall: false,
    appDefinitionAddress: "0xfDd8b7c07960214C025B74e28733D30cF67A652d",
    name: "EthUnidirectionalTransferApp",
    network: Network.KOVAN,
    outcomeType: OutcomeType.TWO_PARTY_DYNAMIC_OUTCOME,
    stateEncoding: "tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)",
  },
  {
    allowNodeInstall: true,
    appDefinitionAddress: "0x92E0bC808f7549c7f8f37b45960D6dCFd343d909",
    name: KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP,
    network: Network.KOVAN,
    outcomeType: OutcomeType.TWO_PARTY_DYNAMIC_OUTCOME, // TODO?
    stateEncoding:
      "tuple(tuple(address to, address[] coinAddress, uint256[] balance)[] coinBalances)",
  },
];

const logger = new CLogger("AppRegistryProvider");
// TODO: can we do this a better way?
export const appRegistryProvider: Provider = {
  inject: [AppRegistryRepository],
  provide: AppRegistryProviderId,
  useFactory: async (appRegistryRepository: AppRegistryRepository): Promise<void> => {
    for (const app of defaultApps) {
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
  imports: [TypeOrmModule.forFeature([AppRegistryRepository]), NodeModule],
  providers: [appRegistryProvider, AppRegistryService],
})
export class AppRegistryModule {}
