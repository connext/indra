import { NestFactory } from "@nestjs/core";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { LoggerService } from "./logger/logger.service";

(async () => {
  const log = new LoggerService("Main");
  log.info(`Deploying Indra ${version}`);
  process.on("unhandledRejection", (e: Error) => {
    log.error(`Unhandled Promise Rejection: ${e.stack}`);
  });
  const app = await NestFactory.create(AppModule, { logger: log });
  app.enableCors();
  const config = app.get(ConfigService);
  app.setGlobalPrefix(config.getGlobalPrefix());
  await app.listen(config.getPort());
})();
