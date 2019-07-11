import { Controller, Get } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

import { Network } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Controller()
export class AppRegistryController {
  constructor(private readonly appRegistryRepository: AppRegistryRepository) {}
  @MessagePattern("app-registry")
  async get(data: { name: string; network: Network } | undefined): Promise<any> {
    if (!data || !data.network || !data.name) {
      return await this.appRegistryRepository.find();
    }
    return [await this.appRegistryRepository.findByNameAndNetwork(data.name, data.network)];
  }
}
