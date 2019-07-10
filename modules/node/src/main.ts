import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

console.log(`IndraV2 Node Activated!`);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const messagingUrl = config.getMessagingConfig().messagingUrl;
  app.connectMicroservice({
    options: {
      servers: typeof messagingUrl === "string" ? [messagingUrl] : messagingUrl,
    },
    transport: Transport.NATS,
  });
  await app.startAllMicroservicesAsync();
  await app.listen(config.getPort());
}
bootstrap();
