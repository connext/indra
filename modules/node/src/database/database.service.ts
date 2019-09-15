import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { InitNodeRecords1567158660577 } from "../../migrations/1567158660577-init-node-records";
import { InitHubTables1567158805166 } from "../../migrations/1567158805166-init-hub-tables";
import { AddCollateralizationInFlight1567601573372 } from "../../migrations/1567601573372-add-collateralization-in-flight";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { CFCoreRecord } from "../cfCore/cfCore.entity";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { LinkedTransfer, PeerToPeerTransfer } from "../transfer/transfer.entity";

const entities = [
  AppRegistry,
  Channel,
  CFCoreRecord,
  PaymentProfile,
  LinkedTransfer,
  PeerToPeerTransfer,
];

const migrations = [
  InitNodeRecords1567158660577,
  InitHubTables1567158805166,
  AddCollateralizationInFlight1567601573372,
];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      ...this.config.getPostgresConfig(),
      entities,
      logging: ["error"],
      migrations,
      migrationsRun: true,
      synchronize: false,
      type: "postgres",
    };
  }
}
