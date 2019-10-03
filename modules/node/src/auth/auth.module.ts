import { Module } from "@nestjs/common";

import { MessagingModule } from "../messaging/messaging.module";

import { authProviderFactory } from "./auth.provider";
import { AuthService } from "./auth.service";

@Module({
  exports: [AuthService, authProviderFactory],
  imports: [MessagingModule],
  providers: [AuthService, authProviderFactory],
})
export class AuthModule {}
