import { EntityRepository, Repository } from "typeorm";

import { AppRegistry } from "./appRegistry.entity";

@EntityRepository(AppRegistry)
export class AppRegistryRepository extends Repository<AppRegistry> {
  async findByNameAndNetwork(name: string, chainId: number): Promise<AppRegistry> {
    return this.findOne({
      where: { name, chainId },
    });
  }

  async findByAppDefinitionAddress(appDefinitionAddress: string): Promise<AppRegistry> {
    return this.findOne({
      where: { appDefinitionAddress },
    });
  }
}
