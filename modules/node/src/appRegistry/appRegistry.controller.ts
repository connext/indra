import { Controller, Get } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";

import { AppRegistry, Network } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Controller()
export class AppRegistryController {
  constructor(private readonly appRegistryRepository: AppRegistryRepository) {}
  // @MessagePattern("app-registry")
  // async get(data: { name: string; network: Network } | undefined): Promise<any> {
  //   console.log("recieved message with data:", JSON.stringify(data, null, 2));
  //   if (!data || !data.network || !data.name) {
  //     console.log("returning:", await this.appRegistryRepository.find());
  //     return JSON.stringify(await this.appRegistryRepository.find());
  //   }
  //   return [await this.appRegistryRepository.findByNameAndNetwork(data.name, data.network)];
  // }
}
