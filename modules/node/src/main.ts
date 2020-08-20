import { NestFactory } from "@nestjs/core";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { PinoLogger } from "nestjs-pino";

(async () => {
  const log = new PinoLogger({});
  log.setContext("Main");
  log.error(`Deploying Indra ${version}`);
  process.on("unhandledRejection", (e: Error) => {
    log.error(`Unhandled Promise Rejection: ${e.stack}`);
  });
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useLogger(app.get(PinoLogger));
  app.enableCors();
  const config = app.get(ConfigService);
  await app.listen(config.getPort());
})();
