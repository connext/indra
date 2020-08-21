import { NestFactory } from "@nestjs/core";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { LoggerService } from "./logger/logger.service";

(async () => {
  const log = new LoggerService("Main");
  log.error({ version }, `Deploying Indra`);
  process.on("unhandledRejection", (e: Error) => {
    log.error({ error: e.message, stack: e.stack }, `Unhandled Promise Rejection`);
  });
  const app = await NestFactory.create(AppModule, { logger: log });
  app.enableCors();
  const config = app.get(ConfigService);
  await app.listen(config.getPort());
})();
