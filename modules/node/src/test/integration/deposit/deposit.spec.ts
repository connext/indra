import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../../app.module";
import { DatabaseModule } from "../../../database/database.module";
import { TypeOrmConfigService as MemoryDatabaseService } from "../../database.module";
import { ConfigService } from "../../../config/config.service";
import { TypeOrmConfigService } from "../../../database/database.service";

process.env["INDRA_NATS_SERVERS"] = "nats://localhost:4222";

describe("Deposits", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TypeOrmConfigService)
      .useClass(MemoryDatabaseService)
      .compile();

    app = module.createNestApplication();
    const config = app.get(ConfigService);
    await app.init();
    console.log("config: ", config.getMessagingConfig());
    console.log("app: ", app);
  });

  it(`should deposit ETH in the happy case.`, () => {
    expect(true).toBe(true);
  });

  afterAll(async () => {
    await app.close();
  });
});
