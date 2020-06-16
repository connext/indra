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
import { SetStateCommitment } from "../setStateCommitment/setStateCommitment.entity";
import { ConditionalTransactionCommitment } from "../conditionalCommitment/conditionalCommitment.entity";
import { AppInstance } from "../appInstance/appInstance.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { Withdraw } from "../withdraw/withdraw.entity";
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";
import { Challenge, ProcessedBlock } from "../challenge/challenge.entity";
import { StateProgressedEvent } from "../stateProgressedEvent/stateProgressedEvent.entity";
import { ChallengeUpdatedEvent } from "../challengeUpdatedEvent/challengeUpdatedEvent.entity";

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
import { fastSignedTransfer1583682931763 } from "../../migrations/1583682931763-fast-signed-transfer";
import { typeormSync1584364675207 } from "../../migrations/1584364675207-typeorm-sync";
import { typeormSync21584369931723 } from "../../migrations/1584369931723-typeorm-sync-2";
import { initWithdrawApp1584466373728 } from "../../migrations/1584466373728-init-withdraw-app";
import { cfCoreStoreUpdate1584633495374 } from "../../migrations/1584633495374-cf-core-store-update";
import { createdUpdated1584722683650 } from "../../migrations/1584722683650-created-updated";
import { meta1584732939683 } from "../../migrations/1584732939683-meta";
import { removeStore1585640540983 } from "../../migrations/1585640540983-remove-store";
import { jsonb1585828108215 } from "../../migrations/1585828108215-jsonb";
import { updateCollateralizationTracking1585962441544 } from "../../migrations/1585962441544-update-collateralization-tracking";
import { updateTimeouts1586212135729 } from "../../migrations/1586212135729-update-timeouts";
import { renameAppIdentityHash1586243580160 } from "../../migrations/1586243580160-renameAppIdentityHash";
import { removeXpubsUpdate1586463333688 } from "../../migrations/1586463333688-remove-xpubs-update";
import { renameIdentifiers1586509706761 } from "../../migrations/1586509706761-renameIdentifiers";
import { addLatestAction1587492602160 } from "../../migrations/1587492602160-add-latest-action";
import { initWatcherMethods1587505874044 } from "../../migrations/1587505874044-init-watcher-methods";
import { changePrimaryKeys1588583967151 } from "../../migrations/1588583967151-change-primary-keys";
import { rebalanceTargets1589792004077 } from "../../migrations/1589792004077-rebalance-targets";
import { removeAppProposal1591359031983 } from "../../migrations/1591359031983-remove-app-proposal";
import { appIdentityHashPrimaryCommitmentKeys1591979802157 } from "../../migrations/1591979802157-app-identity-hash-primary-commitment-keys";
import { dropIdentifiers1592148854323 } from "../../migrations/1592148854323-drop-identifiers";
import { storedProcedureCreateAppProposal1592290983473 } from "../../migrations/1592290983473-stored-procedure-create-app-proposal";
import { storedProcedureCreateAppInstance1592291092044 } from "../../migrations/1592291092044-stored-procedure-create-app-instance";
import { storedProcedureUpdateAppInstance1592309341833 } from "../../migrations/1592309341833-stored-procedure-update-app-instance";
import { storedProcedureRemoveAppInstance1592310334011 } from "../../migrations/1592310334011-stored-procedure-remove-app-instance";

export const entities = [
  AppInstance,
  AppRegistry,
  Channel,
  CFCoreRecord,
  RebalanceProfile,
  OnchainTransaction,
  AnonymizedOnchainTransaction,
  ConditionalTransactionCommitment,
  SetStateCommitment,
  SetupCommitment,
  Withdraw,
  WithdrawCommitment,
  Challenge,
  ProcessedBlock,
  StateProgressedEvent,
  ChallengeUpdatedEvent,
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
  fastSignedTransfer1583682931763,
  typeormSync1584364675207,
  typeormSync21584369931723,
  initWithdrawApp1584466373728,
  cfCoreStoreUpdate1584633495374,
  createdUpdated1584722683650,
  meta1584732939683,
  removeStore1585640540983,
  jsonb1585828108215,
  updateCollateralizationTracking1585962441544,
  updateTimeouts1586212135729,
  renameAppIdentityHash1586243580160,
  removeXpubsUpdate1586463333688,
  renameIdentifiers1586509706761,
  addLatestAction1587492602160,
  initWatcherMethods1587505874044,
  changePrimaryKeys1588583967151,
  rebalanceTargets1589792004077,
  removeAppProposal1591359031983,
  appIdentityHashPrimaryCommitmentKeys1591979802157,
  dropIdentifiers1592148854323,
  storedProcedureCreateAppProposal1592290983473,
  storedProcedureCreateAppInstance1592291092044,
  storedProcedureUpdateAppInstance1592309341833,
  storedProcedureRemoveAppInstance1592310334011,
];

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const redisUrl = this.config.getRedisUrl().replace("redis://", "");
    const hostPort = redisUrl.split(":");
    if (hostPort.length !== 2) {
      throw new Error("Invalid redis URL.");
    }

    return {
      ...this.config.getPostgresConfig(),
      entities,
      logging: ["info"],
      migrations,
      migrationsRun: true,
      synchronize: false,
      type: "postgres",
      cache: {
        type: "ioredis",
        options: {
          host: hostPort[0],
          port: Number(hostPort[1]),
        },
      },
    };
  }
}
