import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

console.log(`IndraV2 Node Activated!`);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  await app.listen(config.getPort());
}
bootstrap();
