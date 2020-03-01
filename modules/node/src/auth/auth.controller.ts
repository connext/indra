import { Controller, Get, Post, Body, Query } from "@nestjs/common";

import { VerifyNonceDto } from "./auth.dto";
import { AuthService } from "./auth.service";
import { RpcException } from "@nestjs/microservices";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("getNonce")
  async getNonce(@Query() userPublicIdentifier: string): Promise<string> {
    if (!userPublicIdentifier) {
      throw new RpcException(`No address found in data: ${userPublicIdentifier}`);
    }
    return this.authService.getNonce(userPublicIdentifier);
  }

  @Post("verifyNonce")
  async verifyNonce(@Body() verifyNonceDto: VerifyNonceDto): Promise<string> {
    let {sig, xpub} = verifyNonceDto;
    return this.authService.verifyAndVend(sig, xpub);
  }
}
