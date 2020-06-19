import { Controller, Get } from "@nestjs/common";
import { AppRegistryService, AppRegistry } from "./appRegistry.service";

@Controller("app-registry")
export class AppRegistryController {
  constructor(private readonly appRegistryService: AppRegistryService) {}

  @Get()
  async get(): Promise<AppRegistry[]> {
    return this.appRegistryService.find();
  }
}
