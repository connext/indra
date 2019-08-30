import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { initHubTables1567153366212 } from "../../migrations/1567153366212-init-hub-tables";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { NodeRecord } from "../node/node.entity";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { LinkedTransfer, PeerToPeerTransfer } from "../transfer/transfer.entity";

export const entities = [
  AppRegistry,
  Channel,
  NodeRecord,
  PaymentProfile,
  LinkedTransfer,
  PeerToPeerTransfer,
];
export const viewEntites = [];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      ...this.config.getPostgresConfig(),
      entities: [...entities, ...viewEntites],
      logging: ["error"],
      migrations: [initHubTables1567153366212],
      migrationsRun: true, // !this.config.isDevMode(),
      name: "hubTables",
      synchronize: false, // this.config.isDevMode(),
      type: "postgres",
    };
  }
}
