import { EntityRepository, Repository } from "typeorm";

import { Network } from "../constants";

import { AppRegistry } from "./appRegistry.entity";

@EntityRepository(AppRegistry)
export class AppRegistryRepository extends Repository<AppRegistry> {
  async findByNameAndNetwork(name: string, network: Network): Promise<AppRegistry> {
    return this.findOne({ where: { name, network } });
  }

  async findByAppDefinitionAddress(appDefinitionAddress: string): Promise<AppRegistry> {
    return this.findOne({ where: { appDefinitionAddress } });
  }
}
