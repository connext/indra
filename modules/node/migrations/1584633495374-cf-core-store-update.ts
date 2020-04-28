import { MigrationInterface, QueryRunner } from "typeorm";

export class cfCoreStoreUpdate1584633495374 implements MigrationInterface {
  name = "cfCoreStoreUpdate1584633495374";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "withdraw_commitment" ("id" SERIAL NOT NULL, "value" text NOT NULL, "to" text NOT NULL, "data" text NOT NULL, "channelId" integer, CONSTRAINT "PK_1604b2303dbe20805688689d0a3" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "setup_commitment" ("id" SERIAL NOT NULL, "value" text NOT NULL, "to" text NOT NULL, "data" text NOT NULL, "multisigAddress" text NOT NULL, "channelId" integer, CONSTRAINT "REL_9f5b32d06d63e60256bca71bb4" UNIQUE ("channelId"), CONSTRAINT "PK_f8075a1da1937598a1d1d598c37" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "app_instance_type_enum" AS ENUM('PROPOSAL', 'INSTANCE', 'FREE_BALANCE', 'REJECTED', 'UNINSTALLED')`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "app_instance_outcometype_enum" AS ENUM('TWO_PARTY_FIXED_OUTCOME', 'MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER', 'SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER')`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "app_instance" ("id" SERIAL NOT NULL, "type" "app_instance_type_enum" NOT NULL, "appDefinition" text NOT NULL, "stateEncoding" text NOT NULL, "actionEncoding" text, "appSeqNo" integer NOT NULL, "identityHash" text NOT NULL, "initialState" json NOT NULL, "latestState" json NOT NULL, "latestTimeout" integer NOT NULL, "latestVersionNumber" integer NOT NULL, "initiatorDeposit" text NOT NULL, "initiatorDepositTokenAddress" text NOT NULL, "outcomeType" "app_instance_outcometype_enum" NOT NULL, "proposedByIdentifier" text NOT NULL, "proposedToIdentifier" text NOT NULL, "responderDeposit" text NOT NULL, "responderDepositTokenAddress" text NOT NULL, "timeout" integer NOT NULL, "userParticipantAddress" text, "nodeParticipantAddress" text, "outcomeInterpreterParameters" json, "channelId" integer, CONSTRAINT "UQ_52351d5f79e9c41c711625e4ea7" UNIQUE ("identityHash"), CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff765cc" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "conditional_transaction_commitment" ("id" SERIAL NOT NULL, "freeBalanceAppIdentityHash" text NOT NULL, "interpreterAddr" text NOT NULL, "interpreterParams" text NOT NULL, "multisigAddress" text NOT NULL, "multisigOwners" text array NOT NULL, "signatures" json, "appId" integer, CONSTRAINT "REL_81bcbad53a3d766cc635e94baf" UNIQUE ("appId"), CONSTRAINT "PK_678676ce94a1b8426e05fd802ed" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "set_state_commitment" ("id" SERIAL NOT NULL, "appIdentity" json NOT NULL, "appStateHash" text NOT NULL, "challengeRegistryAddress" text NOT NULL, "signatures" json, "timeout" integer NOT NULL, "versionNumber" integer NOT NULL, "appId" integer, CONSTRAINT "PK_b64d8b0a8c30a8df8c63ad511f4" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "schemaVersion" integer NOT NULL DEFAULT ${0}`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" ADD "addresses" json`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "monotonicNumProposedApps" integer`,
      undefined,
    );
    // TODO: fix
    // await queryRunner.query(
    //   `ALTER TABLE "channel" ADD CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48" UNIQUE ("multisigAddress")`,
    //   undefined,
    // );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" ADD CONSTRAINT "FK_9f5b32d06d63e60256bca71bb42" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "FK_81bcbad53a3d766cc635e94baf5" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "FK_6eb316c0bb4a9307a8bb1ae77b6" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "FK_6eb316c0bb4a9307a8bb1ae77b6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "FK_81bcbad53a3d766cc635e94baf5"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment" DROP CONSTRAINT "FK_9f5b32d06d63e60256bca71bb42"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP COLUMN "monotonicNumProposedApps"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "addresses"`, undefined);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "schemaVersion"`, undefined);
    await queryRunner.query(`DROP TABLE "set_state_commitment"`, undefined);
    await queryRunner.query(`DROP TABLE "conditional_transaction_commitment"`, undefined);
    await queryRunner.query(`DROP TABLE "app_instance"`, undefined);
    await queryRunner.query(`DROP TYPE "app_instance_outcometype_enum"`, undefined);
    await queryRunner.query(`DROP TYPE "app_instance_type_enum"`, undefined);
    await queryRunner.query(`DROP TABLE "setup_commitment"`, undefined);
    await queryRunner.query(`DROP TABLE "withdraw_commitment"`, undefined);
  }
}
