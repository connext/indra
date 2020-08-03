import { AppRegistry } from "@connext/types";
import { Controller, Get, Param } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";

@Controller("app-registry")
export class AppRegistryController {
  constructor(private readonly cfCoreService: CFCoreService) {}

  @Get(":chainId")
  async get(@Param("chainId") chainId: number): Promise<AppRegistry> {
    return this.cfCoreService.getAppRegistry(chainId);
  }
}
