import { Controller, Get, Inject } from "@nestjs/common";

import { CFCoreProviderId } from "../constants";
import { CFCore } from "../util/cfCore";

@Controller("cf-core")
export class CFCoreController {
  constructor(@Inject(CFCoreProviderId) private readonly cfCore: CFCore) {}
  @Get()
  find(): any {
    return this.cfCore.publicIdentifier;
  }
}
