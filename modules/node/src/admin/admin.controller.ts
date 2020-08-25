import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
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
  async uninstallDepositApp(
    @Body() { multisigAddress, assetId }: UninstallDepositAppDto,
    @Headers("x-auth-token") token: string,
  ): Promise<string | undefined> {
    if (token !== this.configService.getAdminToken()) {
      throw new UnauthorizedException();
    }
    try {
      const res = await this.adminService.uninstallDepositAppForChannel(multisigAddress, assetId);
      return res;
    } catch (e) {
      if (e.message.includes("Channel does not exist for multisig")) {
        throw new NotFoundException();
      }
      throw new BadRequestException(e.message);
    }
  }
}
