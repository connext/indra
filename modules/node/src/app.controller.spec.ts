import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ChannelModule } from "./channel/channel.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { ExchangeRateModule } from "./exchangeRate/exchangeRate.module";
import { NatsModule } from "./nats/nats.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { UserModule } from "./user/user.module";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController, NodeController],
      imports: [
        ConfigModule,
        NodeModule,
        UserModule,
        ChannelModule,
        DatabaseModule,
        NatsModule,
        ExchangeRateModule,
      ],
      providers: [AppService],
    }).compile();

    appController = await app.get<AppController>(AppController);
  });

  it(`should return "Hello World!"`, () => {
    expect(appController.getHello()).toBe("Hello World!");
  });
});
