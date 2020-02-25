import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { CFCoreRecord } from "../cfCore/cfCore.entity";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import {
  OnchainTransaction,
  AnonymizedOnchainTransaction,
} from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import {
  LinkedTransfer,
  PeerToPeerTransfer,
  Transfer,
  AnonymizedTransfer,
} from "../transfer/transfer.entity";

// Import Migrations
import { InitNodeRecords1567158660577 } from "../../migrations/1567158660577-init-node-records";
import { InitHubTables1567158805166 } from "../../migrations/1567158805166-init-hub-tables";
import { AddCollateralizationInFlight1567601573372 } from "../../migrations/1567601573372-add-collateralization-in-flight";
import { AddReclaimedLinks1568746114079 } from "../../migrations/1568746114079-add-reclaimed-links";
import { AddOnchainTransactions1569489199954 } from "../../migrations/1569489199954-add-onchain-transaction";
import { AddRecipientToLinks1569862328684 } from "../../migrations/1569862328684-add-recipient-to-links";
import { AddTransferView1571072372000 } from "../../migrations/1571072372000-add-transfer-view";
import { AddTransferMetas1574449936874 } from "../../migrations/1574449936874-add-transfer-metas";
import { AddCfcoreTimestamps1574451273832 } from "../../migrations/1574451273832-add-cfcore-timestamps";
import { EditViewTable1578621554000 } from "../../migrations/1578621554000-edit-view-table";
import { NetworkToChainId1579686361011 } from "../../migrations/1579686361011-network-to-chain-id";
import { AddAnonymizedViewTables1581090243171 } from "../../migrations/1581090243171-add-anonymized-view-tables";
import { RebalancingProfile1581796200880 } from "../../migrations/1581796200880-rebalancing-profile";

export const entities = [
  AppRegistry,
  Channel,
  CFCoreRecord,
  RebalanceProfile,
  LinkedTransfer,
  PeerToPeerTransfer,
  OnchainTransaction,
  Transfer,
  AnonymizedOnchainTransaction,
  AnonymizedTransfer,
];

export const migrations = [
  InitNodeRecords1567158660577,
  InitHubTables1567158805166,
  AddCollateralizationInFlight1567601573372,
  AddReclaimedLinks1568746114079,
  AddOnchainTransactions1569489199954,
  AddRecipientToLinks1569862328684,
  AddTransferView1571072372000,
  AddCfcoreTimestamps1574451273832,
  AddTransferMetas1574449936874,
  EditViewTable1578621554000,
  NetworkToChainId1579686361011,
  AddAnonymizedViewTables1581090243171,
  RebalancingProfile1581796200880,
];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService, private readonly logger: LoggerService) {}
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
