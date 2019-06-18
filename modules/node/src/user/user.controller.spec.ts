import { Test, TestingModule } from "@nestjs/testing";

import { UserController } from "./user.controller";
import { UserModule } from "./user.module";
import { UserService } from "./user.service";

describe("User Controller", () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      imports: [UserModule],
      providers: [UserService],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
