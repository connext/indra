import { Test, TestingModule } from "@nestjs/testing";

import { ConfigController } from "./config.controller";
import { ConfigModule } from "./config.module";

describe("Config Controller", () => {
  let controller: ConfigController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
