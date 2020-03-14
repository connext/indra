/* eslint-disable max-len */
import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { CFCoreRecord } from "../cfCore/cfCore.entity";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import {
  OnchainTransaction,
  AnonymizedOnchainTransaction,
} from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { SetStateCommitmentEntity } from "../setStateCommitment/setStateCommitment.entity";
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";
import { ConditionalTransactionCommitmentEntity } from "../conditionalCommitment/conditionalCommitment.entity";
import { AppInstance } from "../appInstance/appInstance.entity";
import { Transfer } from "../transfer/transfer.entity";
import { AnonymizedTransfer } from "../anonymizedTransfer/anonymizedTransfer.entity";
import { FastSignedTransfer } from "../fastSignedTransfer/fastSignedTransfer.entity";
import { LinkedTransfer } from "../linkedTransfer/linkedTransfer.entity";
import { SetupCommitmentEntity } from "../setupCommitment/setupCommitment.entity";

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
import { InitCommitmentTable1582692126872 } from "../../migrations/1582692126872-init-commitment-table";
import { InitAppInstanceTable1583612960994 } from "../../migrations/1583612960994-init-app-instance-table";
import { UpdateChannelTable1583618773094 } from "../../migrations/1583618773094-update-channel-table";
import { fastSignedTransfer1583682931763 } from "../../migrations/1583682931763-fast-signed-transfer";

export const entities = [
  AppInstance,
  AppRegistry,
  Channel,
  CFCoreRecord,
  RebalanceProfile,
  LinkedTransfer,
  OnchainTransaction,
  Transfer,
  AnonymizedOnchainTransaction,
  AnonymizedTransfer,
  ConditionalTransactionCommitmentEntity,
  SetStateCommitmentEntity,
  WithdrawCommitment,
  FastSignedTransfer,
  SetupCommitmentEntity,
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
  InitCommitmentTable1582692126872,
  InitAppInstanceTable1583612960994,
  UpdateChannelTable1583618773094,
  fastSignedTransfer1583682931763,
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
