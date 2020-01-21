import { NestFactory } from "@nestjs/core";
import { Transport } from "@nestjs/microservices";

import { version } from "../package.json";

import { AppModule } from "./app.module";
import { AdminService } from "./admin/admin.service";
import { ConfigService } from "./config/config.service";
import { CLogger } from "./util";

const logger = new CLogger("Main");
logger.log(`Deploying Indra ${version}`);

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
  // Veryify & attempt to fix critical addresses on startup before starting listeners
  const adminService = app.get(AdminService);
  await adminService.repairCriticalStateChannelAddresses();
  await app.listen(config.getPort());
}
bootstrap();
