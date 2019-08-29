import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { initialMigration1567091591712 } from "../../migrations/1567091591712-initialMigration";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { LinkedTransfer, PeerToPeerTransfer } from "../transfer/transfer.entity";

export const entities = [AppRegistry, Channel, PaymentProfile, LinkedTransfer, PeerToPeerTransfer];
export const viewEntites = [];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      ...this.config.getPostgresConfig(),
      entities: [...entities, ...viewEntites],
      logging: ["error"],
      migrations: [initialMigration1567091591712],
      migrationsRun: !this.config.isDevMode(),
      synchronize: this.config.isDevMode(),
      type: "postgres",
    };
  }
}
