import { Controller, Get } from "@nestjs/common";
import { hexlify, randomBytes } from "ethers/utils";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async getAuth(): Promise<string> {
    return JSON.stringify({
      nonce: hexlify(randomBytes(32)),
    });
  }
}
