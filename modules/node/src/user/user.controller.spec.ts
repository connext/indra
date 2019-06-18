import { PostgresConnectionOptions } from "@counterfactual/postgresql-node-connector";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";

import { entities } from "../app.module";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";

import { UserController } from "./user.controller";
import { UserModule } from "./user.module";
import { UserService } from "./user.service";

describe("User Controller", () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      imports: [
        UserModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => {
            return {
              ...config.getPostgresConfig(),
              entities,
              synchronize: true,
              type: "postgres",
            } as PostgresConnectionOptions;
          },
        }),
      ],
      providers: [UserService],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
