import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { App, AppUpdate } from "../app/app.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel, ChannelUpdate, NodeChannel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { User } from "../user/user.entity";

export const entities = [App, AppRegistry, AppUpdate, Channel, ChannelUpdate, PaymentProfile, User];
export const viewEntites = [NodeChannel];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      ...this.config.getPostgresConfig(),
      entities: [...entities, ...viewEntites],
      logging: ["error"],
      synchronize: true,
      type: "postgres",
    };
  }
}
