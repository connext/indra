import { Controller, Get, Options, Post, Body, Param, BadRequestException } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";

import { VerifyNonceDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly log: LoggerService) {
    this.log.setContext("AuthController");
  }

  @Get(":userIdentifier")
  async getNonce(@Param("userIdentifier") userIdentifier: string): Promise<string> {
    return this.authService.getNonce(userIdentifier);
  }

  @Options("")
  async noop(): Promise<void> {
    return;
  }

  @Post("")
  async verifyNonce(@Body() verifyNonceDto: VerifyNonceDto): Promise<string> {
    const { sig, userIdentifier, adminToken } = verifyNonceDto;
    try {
      return this.authService.verifyAndVend(sig, userIdentifier, adminToken);
    } catch (e) {
      this.log.error(e);
      throw new BadRequestException(`Signature not verified: ${e.toString()}`);
    }
  }
}
