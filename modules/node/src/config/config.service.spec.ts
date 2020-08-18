import { ConfigService } from "./config.service";
import { LoggerService } from "../logger/logger.service";

import { expect } from "../test/utils";

describe("ConfigService", () => {
  const configService = new ConfigService(new LoggerService());

  it("can getPort", () => {
    const port = configService.getPort();
    expect(port).to.be.a("number");
  });
});
