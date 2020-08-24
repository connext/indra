import { Controller, Post, Body, Headers, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "../config/config.service";

import { AdminService } from "./admin.service";

export class UninstallDepositAppDto {
  multisigAddress!: string;
  assetId?: string;
}

@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}
  @Post("uninstall-deposit")
  uninstallDepositApp(
    @Body() { multisigAddress, assetId }: UninstallDepositAppDto,
    @Headers("auth-token") token: string,
  ): Promise<string | undefined> {
    if (token !== this.configService.getAdminToken()) {
      throw new UnauthorizedException();
    }
    return this.adminService.uninstallDepositAppForChannel(multisigAddress, assetId);
  }
}
