import { ColorfulLogger, getRandomChannelSigner } from "@connext/utils";
import { Test, TestingModule } from "@nestjs/testing";

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
    await app.listen();
  });

  it("should throw an error on startup if node is broke", async () => {
    const configService = new MockConfigService(getRandomChannelSigner(env.ethProviderUrl));
    log.info(`Creatted a config service`);
    expect(
      Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ConfigService)
        .useValue(configService)
        .compile(),
    ).to.be.rejectedWith("balance is zero");
  });
});
