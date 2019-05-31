import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";

import { UserController } from "./user.controller";
import { userProvider } from "./user.provider";
import { UserService } from "./user.service";

@Module({
  imports: [DatabaseModule],
  providers: [userProvider, UserService],
  controllers: [UserController],
})
export class UserModule {}
