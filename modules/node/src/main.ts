import { NestFactory } from "@nestjs/core";
import { Transport, ConsumerDeserializer, IncomingRequest } from "@nestjs/microservices";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { LoggerService } from "./logger/logger.service";
import { CLogger } from "./util";

new CLogger("Main").log(`Deploying Indra ${version}`);

class IdDeserializer implements ConsumerDeserializer {
  deserialize(value: any): IncomingRequest {
    return value;
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // ["error", "warn", "log", "debug", "verbose"].slice(0, parseInt(process.env.LOG_LEVEL, 10))
    logger: false, // ["error", "warn", "log"],
  });
  app.useLogger(new LoggerService("Main"));
  const config = app.get(ConfigService);
  const messagingUrl = config.getMessagingConfig().messagingUrl;
  app.connectMicroservice({
    options: {
      deserializer: new IdDeserializer(),
      servers: typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl,
    },
    transport: Transport.NATS,
  });
  await app.startAllMicroservicesAsync();
  await app.listen(config.getPort());
}
bootstrap();
