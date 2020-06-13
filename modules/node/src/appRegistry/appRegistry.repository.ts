import { EntityRepository, Repository } from "typeorm";

import { AppRegistry } from "./appRegistry.entity";
import { instrument } from "../logger/instrument";

@EntityRepository(AppRegistry)
export class AppRegistryRepository extends Repository<AppRegistry> {
  async findByNameAndNetwork(name: string, chainId: number): Promise<AppRegistry> {
    return instrument("AppRegistryRepository:findByNameAndNetwork", () =>
      this.findOne({
        where: { name, chainId },
      }),
    );
  }

  async findByAppDefinitionAddress(appDefinitionAddress: string): Promise<AppRegistry> {
    return instrument("AppRegistryRepository:findByAppDefinitionAddress", () =>
      this.findOne({
        where: { appDefinitionAddress },
      }),
    );
  }
}
