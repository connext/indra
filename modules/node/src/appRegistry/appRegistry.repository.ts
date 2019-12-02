import { SupportedNetwork } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { AppRegistry } from "./appRegistry.entity";

@EntityRepository(AppRegistry)
export class AppRegistryRepository extends Repository<AppRegistry> {
  async findByNameAndNetwork(name: string, network: SupportedNetwork): Promise<AppRegistry> {
    return this.findOne({ where: { name, network } });
  }

  async findByAppDefinitionAddress(appDefinitionAddress: string): Promise<AppRegistry> {
    return this.findOne({ where: { appDefinitionAddress } });
  }
}
