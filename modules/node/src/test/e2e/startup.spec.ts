import { ColorfulLogger, getRandomChannelSigner } from "@connext/utils";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";

import { AppModule } from "../../app.module";
import { ConfigService } from "../../config/config.service";

import { env, expect, MockConfigService } from "../utils";

describe("Startup", () => {
  const log = new ColorfulLogger("TestStartup", env.logLevel, true, "T");
  let app: INestApplication;

  afterEach(async () => {
    try {
      await app.close();
      log.info(`Application was shutdown successfully`);
    } catch (e) {
      log.warn(`Application was shutdown unsuccessfully: ${e.message}`);
    }
  });

  it("should start up w/out error", async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useClass(MockConfigService)
      .compile();
    app = moduleFixture.createNestApplication();
    expect(app.init()).to.not.be.rejected;
    const configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.listen(configService.getPort());
  });

  it("should still start up even if the node has zero balance", async () => {
    const configService = new MockConfigService({
      signer: getRandomChannelSigner(env.ethProviderUrl),
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();
    app = moduleFixture.createNestApplication();
    expect(app.init()).to.not.be.rejected;
    await app.listen(configService.getPort());
  });
});
