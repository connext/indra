import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

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
      synchronize: true, // TODO: this.config.isDevMode(),
      type: "postgres",
    };
  }
}
