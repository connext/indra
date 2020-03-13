import { Controller, Get, Post, Body, Param, BadRequestException } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";

import { VerifyNonceDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly log: LoggerService) {
    this.log.setContext("AuthController");
  }

  @Get(":userPublicIdentifier")
  async getNonce(@Param("userPublicIdentifier") userPublicIdentifier: string): Promise<string> {
    return this.authService.getNonce(userPublicIdentifier);
  }

  @Post("")
  async verifyNonce(@Body() verifyNonceDto: VerifyNonceDto): Promise<string> {
    let { sig, userPublicIdentifier, adminToken } = verifyNonceDto;
    try {
      return this.authService.verifyAndVend(sig, userPublicIdentifier, adminToken);
    } catch (e) {
      this.log.error(e);
      throw new BadRequestException(`Signature not verified: ${e.toString()}`);
    }
  }
}
