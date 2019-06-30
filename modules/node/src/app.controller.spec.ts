import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      imports: [],
      providers: [AppService],
    }).compile();

    appController = await app.get<AppController>(AppController);
  });

  it(`should return "Hello World!"`, () => {
    expect(appController.getHello()).toBe("Hello World!");
  });
});
