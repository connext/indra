import { Controller } from "@nestjs/common";
import { MessagePattern, Payload, Ctx, NatsContext } from "@nestjs/microservices";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";
import { from, Observable } from "rxjs";

@Controller()
export class AppRegistryController {
  constructor(private readonly appRegistryRepository: AppRegistryRepository) {}

  @MessagePattern("app-registry")
  async get(
    data: { name?: string; chainId?: number; appDefinitionAddress?: string } | undefined,
  ): Promise<AppRegistry[]> {
    if (data && data.chainId && data.name) {
      return [await this.appRegistryRepository.findByNameAndNetwork(data.name, data.chainId)];
    }

    if (data && data.appDefinitionAddress) {
      return [
        await this.appRegistryRepository.findByAppDefinitionAddress(data.appDefinitionAddress),
      ];
    }
    return await this.appRegistryRepository.find();
  }

  @MessagePattern("app-registry-hello")
  hello(@Payload() data: any, @Ctx() context: NatsContext) {
    return "Hi";
  }

  @MessagePattern("sum")
  accumulate(data: number[]): Observable<number> {
    return from([1, 2, 3]);
  }
}
