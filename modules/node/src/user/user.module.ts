import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

@Module({
  controllers: [],
  exports: [UserService, TypeOrmModule.forFeature([UserRepository])],
  imports: [TypeOrmModule.forFeature([UserRepository])],
  providers: [UserService],
})
export class UserModule {}
