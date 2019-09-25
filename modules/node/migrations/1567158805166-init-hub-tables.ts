import { MigrationInterface, QueryRunner } from "typeorm";

export class InitHubTables1567158805166 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE TYPE "app_registry_network_enum"
      AS ENUM('ganache', 'kovan', 'rinkeby', 'ropsten', 'goerli', 'homestead')
    `);
    await queryRunner.query(`
      CREATE TYPE "app_registry_outcometype_enum"
      AS ENUM('TWO_PARTY_FIXED_OUTCOME', 'MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER', 'SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER')
    `);
    await queryRunner.query(`
      CREATE TABLE "app_registry" (
        "id" SERIAL NOT NULL,
        "name" text NOT NULL,
        "network" "app_registry_network_enum" NOT NULL,
        "outcomeType" "app_registry_outcometype_enum" NOT NULL,
        "appDefinitionAddress" text NOT NULL,
        "stateEncoding" text NOT NULL,
        "actionEncoding" text,
        "allowNodeInstall" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_0ad3967947b8e96a4e6cbc4827e" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "payment_profile" (
        "id" SERIAL NOT NULL,
        "minimumMaintainedCollateral" text NOT NULL DEFAULT '0',
        "amountToCollateralize" text NOT NULL DEFAULT '0',
        "assetId" text NOT NULL,
        CONSTRAINT "PK_643552fcfc44ed6f6036befe656" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "peer_to_peer_transfer_status_enum"
      AS ENUM('PENDING', 'COMPLETED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TABLE "peer_to_peer_transfer" (
        "id" SERIAL NOT NULL,
        "amount" text NOT NULL,
        "assetId" text NOT NULL,
        "appInstanceId" text NOT NULL,
        "status" "peer_to_peer_transfer_status_enum" NOT NULL DEFAULT 'PENDING',
        "senderChannelId" integer,
        "receiverChannelId" integer,
        CONSTRAINT "PK_92d949ff4ae3cad8ae841f16b1a" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "linked_transfer_status_enum"
      AS ENUM('PENDING', 'CREATED', 'REDEEMED', 'FAILED')
    `);
    await queryRunner.query(`
      CREATE TABLE "linked_transfer" (
        "id" SERIAL NOT NULL,
        "amount" text NOT NULL,
        "assetId" text NOT NULL,
        "senderAppInstanceId" text NOT NULL,
        "receiverAppInstanceId" text,
        "linkedHash" text NOT NULL,
        "preImage" text,
        "paymentId" text,
        "status" "linked_transfer_status_enum" NOT NULL DEFAULT 'PENDING',
        "senderChannelId" integer,
        "receiverChannelId" integer,
        CONSTRAINT "PK_70a97be717001119e55d2238525" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "channel" (
        "id" SERIAL NOT NULL,
        "userPublicIdentifier" text NOT NULL,
        "nodePublicIdentifier" text NOT NULL,
        "multisigAddress" text NOT NULL,
        "available" boolean NOT NULL DEFAULT false,
        "depositInFlight" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "channel_payment_profiles_payment_profile" (
        "channelId" integer NOT NULL,
        "paymentProfileId" integer NOT NULL,
        CONSTRAINT "PK_bd66c333fa8b5b80eecf1f6a49f" PRIMARY KEY ("channelId", "paymentProfileId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_e13899dee318fd939719e9b338"
      ON "channel_payment_profiles_payment_profile" ("channelId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_a5bdc94414f8e850e0c7c108c4"
      ON "channel_payment_profiles_payment_profile" ("paymentProfileId")
    `);
    await queryRunner.query(`
      ALTER TABLE "peer_to_peer_transfer"
      ADD CONSTRAINT "FK_83c47d9bfe33419dad37400d5db"
      FOREIGN KEY ("senderChannelId")
      REFERENCES "channel"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "peer_to_peer_transfer"
      ADD CONSTRAINT "FK_1d7f2a32b20c2a27afc62b3bde1"
      FOREIGN KEY ("receiverChannelId")
      REFERENCES "channel"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ADD CONSTRAINT "FK_2bfee41282e7a522b53588b6b97"
      FOREIGN KEY ("senderChannelId")
      REFERENCES "channel"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ADD CONSTRAINT "FK_a08194603341158bed722a0635f"
      FOREIGN KEY ("receiverChannelId")
      REFERENCES "channel"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "channel_payment_profiles_payment_profile"
      ADD CONSTRAINT "FK_e13899dee318fd939719e9b338a"
      FOREIGN KEY ("channelId")
      REFERENCES "channel"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "channel_payment_profiles_payment_profile"
      ADD CONSTRAINT "FK_a5bdc94414f8e850e0c7c108c46"
      FOREIGN KEY ("paymentProfileId")
      REFERENCES "payment_profile"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel_payment_profiles_payment_profile"
      DROP CONSTRAINT "FK_a5bdc94414f8e850e0c7c108c46"
    `);
    await queryRunner.query(`
      ALTER TABLE "channel_payment_profiles_payment_profile"
      DROP CONSTRAINT "FK_e13899dee318fd939719e9b338a"
    `);
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      DROP CONSTRAINT "FK_a08194603341158bed722a0635f"
    `);
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      DROP CONSTRAINT "FK_2bfee41282e7a522b53588b6b97"
    `);
    await queryRunner.query(`
      ALTER TABLE "peer_to_peer_transfer"
      DROP CONSTRAINT "FK_1d7f2a32b20c2a27afc62b3bde1"
    `);
    await queryRunner.query(`
      ALTER TABLE "peer_to_peer_transfer"
      DROP CONSTRAINT "FK_83c47d9bfe33419dad37400d5db"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_a5bdc94414f8e850e0c7c108c4"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_e13899dee318fd939719e9b338"
    `);
    await queryRunner.query(`
      DROP TABLE "channel_payment_profiles_payment_profile"
    `);
    await queryRunner.query(`
      DROP TABLE "channel"
    `);
    await queryRunner.query(`
      DROP TABLE "linked_transfer"
    `);
    await queryRunner.query(`
      DROP TYPE "linked_transfer_status_enum"
    `);
    await queryRunner.query(`
      DROP TABLE "peer_to_peer_transfer"
    `);
    await queryRunner.query(`
      DROP TYPE "peer_to_peer_transfer_status_enum"
    `);
    await queryRunner.query(`
      DROP TABLE "payment_profile"
    `);
    await queryRunner.query(`
      DROP TABLE "app_registry"
    `);
    await queryRunner.query(`
      DROP TYPE "app_registry_outcometype_enum"
    `);
    await queryRunner.query(`
      DROP TYPE "app_registry_network_enum"
    `);
  }
}
