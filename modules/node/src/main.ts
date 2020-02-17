import { NestFactory } from "@nestjs/core";
import { Transport, ConsumerDeserializer, IncomingRequest } from "@nestjs/microservices";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import { CLogger } from "./util";

const logger = new CLogger("Main");
logger.log(`Deploying Indra ${version}`);

class IdDeserializer implements ConsumerDeserializer {
  deserialize(value: any): IncomingRequest {
    return value;
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
