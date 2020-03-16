import { MigrationInterface, QueryRunner } from "typeorm";

export class cfCoreStoreUpdate1584381845220 implements MigrationInterface {
  name = "cfCoreStoreUpdate1584381845220";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "withdraw_commitment" ("id" SERIAL NOT NULL, "value" text NOT NULL, "to" text NOT NULL, "data" text NOT NULL, "channelId" integer, CONSTRAINT "PK_1604b2303dbe20805688689d0a3" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "setup_commitment_entity" ("id" SERIAL NOT NULL, "value" text NOT NULL, "to" text NOT NULL, "data" text NOT NULL, "multisigAddress" text NOT NULL, "channelId" integer, CONSTRAINT "REL_eddb8e2886ebe1803b8c16441b" UNIQUE ("channelId"), CONSTRAINT "PK_fa5779b2776b9316c7103a88832" PRIMARY KEY ("id"))`,
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
      `CREATE TABLE "app_instance" ("id" SERIAL NOT NULL, "type" "app_instance_type_enum" NOT NULL, "appDefinition" text NOT NULL, "stateEncoding" text NOT NULL, "actionEncoding" text, "appSeqNo" integer NOT NULL, "identityHash" text NOT NULL, "initialState" json NOT NULL, "latestState" json NOT NULL, "latestTimeout" integer NOT NULL, "latestVersionNumber" integer NOT NULL, "initiatorDeposit" text NOT NULL, "initiatorDepositTokenAddress" text NOT NULL, "outcomeType" "app_instance_outcometype_enum" NOT NULL, "proposedByIdentifier" text NOT NULL, "proposedToIdentifier" text NOT NULL, "responderDeposit" text NOT NULL, "responderDepositTokenAddress" text NOT NULL, "timeout" integer NOT NULL, "userParticipantAddress" text, "nodeParticipantAddress" text, "outcomeInterpreterParameters" json, "channelId" integer, CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff765cc" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "conditional_transaction_commitment_entity" ("id" SERIAL NOT NULL, "freeBalanceAppIdentityHash" text NOT NULL, "interpreterAddr" text NOT NULL, "interpreterParams" text NOT NULL, "multisigAddress" text NOT NULL, "multisigOwners" text array NOT NULL, "signatures" json, "appId" integer, CONSTRAINT "REL_e3a7c98f678b143aeb86ad4e5a" UNIQUE ("appId"), CONSTRAINT "PK_f3a61244b0460d281b2ae9ecc00" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "set_state_commitment_entity" ("id" SERIAL NOT NULL, "appIdentity" json NOT NULL, "appStateHash" text NOT NULL, "challengeRegistryAddress" text NOT NULL, "signatures" json, "timeout" integer NOT NULL, "versionNumber" integer NOT NULL, "appId" integer, CONSTRAINT "REL_27f30bdf0b43ac4e99a348915d" UNIQUE ("appId"), CONSTRAINT "PK_2bca88681db8894ae8d25022593" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "schemaVersion" integer NOT NULL`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" ADD "addresses" json NOT NULL`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "monotonicNumProposedApps" integer NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" ADD CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment_entity" ADD CONSTRAINT "FK_eddb8e2886ebe1803b8c16441ba" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment_entity" ADD CONSTRAINT "FK_e3a7c98f678b143aeb86ad4e5aa" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment_entity" ADD CONSTRAINT "FK_27f30bdf0b43ac4e99a348915dc" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment_entity" DROP CONSTRAINT "FK_27f30bdf0b43ac4e99a348915dc"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment_entity" DROP CONSTRAINT "FK_e3a7c98f678b143aeb86ad4e5aa"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "setup_commitment_entity" DROP CONSTRAINT "FK_eddb8e2886ebe1803b8c16441ba"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw_commitment" DROP CONSTRAINT "FK_6fa1849645b99a7e063abb4d5b0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP COLUMN "monotonicNumProposedApps"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "addresses"`, undefined);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "schemaVersion"`, undefined);
    await queryRunner.query(`DROP TABLE "set_state_commitment_entity"`, undefined);
    await queryRunner.query(`DROP TABLE "conditional_transaction_commitment_entity"`, undefined);
    await queryRunner.query(`DROP TABLE "app_instance"`, undefined);
    await queryRunner.query(`DROP TYPE "app_instance_outcometype_enum"`, undefined);
    await queryRunner.query(`DROP TYPE "app_instance_type_enum"`, undefined);
    await queryRunner.query(`DROP TABLE "setup_commitment_entity"`, undefined);
    await queryRunner.query(`DROP TABLE "withdraw_commitment"`, undefined);
  }
}
