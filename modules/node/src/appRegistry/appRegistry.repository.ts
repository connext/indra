import { EntityRepository, Repository } from "typeorm";

import { AppRegistry, Network } from "./appRegistry.entity";

@EntityRepository(AppRegistry)
export class AppRegistryRepository extends Repository<AppRegistry> {
  async findByNameAndNetwork(name: string, network: Network): Promise<AppRegistry> {
    return await this.findOne({ where: { name, network } });
  }
}
