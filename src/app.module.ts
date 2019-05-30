import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "./config/config.module";
import { NodeController } from "./node/node.controller";
import { NodeModule } from "./node/node.module";
import { NodeProvider } from "./node/node.provider";

@Module({
  imports: [ConfigModule, NodeModule],
  controllers: [AppController, NodeController],
  providers: [AppService, NodeProvider],
})
export class AppModule {}
