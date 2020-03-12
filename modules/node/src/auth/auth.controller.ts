import { Controller, Get, Post, Body, Param } from "@nestjs/common";

import { VerifyNonceDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("nonce/:userPublicIdentifier")
  async getNonce(@Param() userPublicIdentifier: string): Promise<string> {
    return this.authService.getNonce(userPublicIdentifier);
  }

  @Post("nonce")
  async verifyNonce(@Body() verifyNonceDto: VerifyNonceDto): Promise<string> {
    let { sig, userPublicIdentifier, adminToken } = verifyNonceDto;
    return this.authService.verifyAndVend(sig, userPublicIdentifier, adminToken);
  }
}
