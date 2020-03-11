import { NestFactory } from "@nestjs/core";
import {
  Transport,
  ConsumerDeserializer,
  IncomingRequest,
  NatsOptions,
} from "@nestjs/microservices";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { LoggerService } from "./logger/logger.service";
import { AuthService } from "./auth/auth.service";

class IdDeserializer implements ConsumerDeserializer {
  deserialize(value: any): IncomingRequest {
    return value;
  }
}

async function bootstrap(): Promise<void> {
  const log = new LoggerService("Main");
  log.info(`Deploying Indra ${version}`);
  const app = await NestFactory.create(AppModule, { logger: log });
  const config = app.get(ConfigService);
  const auth = app.get(AuthService);
  const messagingUrl = config.getMessagingConfig().messagingUrl;
  const userJWT = await auth.vendAdminToken(config.getPublicIdentifier());
  app.connectMicroservice({
    options: {
      deserializer: new IdDeserializer(),
      servers: typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl,
      userJWT,
    },
    transport: Transport.NATS,
  } as NatsOptions);
  await app.startAllMicroservicesAsync();
  await app.listen(config.getPort());
}
bootstrap();
