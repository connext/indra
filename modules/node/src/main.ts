import { NestFactory } from "@nestjs/core";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { LoggerService } from "./logger/logger.service";

async function bootstrap(): Promise<void> {
  const log = new LoggerService("Main");
  log.info(`Deploying Indra ${version}`);
  const app = await NestFactory.create(AppModule, { logger: log });
  app.enableCors();
  const config = app.get(ConfigService);
  await app.listen(config.getPort());
}
bootstrap();
