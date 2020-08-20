import { ConfigService } from "./config.service";
import { PinoLogger } from "nestjs-pino";

describe("ConfigService", () => {
  const configService = new ConfigService(new PinoLogger({ renameContext: "Test" }));

  it("can getPort", () => {
    const port = configService.getPort();
    console.log(`Port: ${port}`);
  });
});
