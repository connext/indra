import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseModule } from "../database/database.module";

import { UserController } from "./user.controller";
import { userProvider } from "./user.provider";
import { UserService } from "./user.service";

describe("User Controller", () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      imports: [DatabaseModule],
      providers: [userProvider, UserService],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
