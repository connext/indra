import { Controller, Get } from "@nestjs/common";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

@Controller("app-registry")
export class AppRegistryController {
  constructor(private readonly appRegistryRepository: AppRegistryRepository) {}

  @Get()
  async get(): Promise<AppRegistry[]> {
    return this.appRegistryRepository.find();
  }
}
