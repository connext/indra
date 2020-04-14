import {MigrationInterface, QueryRunner} from "typeorm";

export class removeXpubsUpdate1586463333688 implements MigrationInterface {
    name = 'removeXpubsUpdate1586463333688'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["public","anonymized_onchain_transaction"]);
        await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "initiatorDepositTokenAddress"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "proposedByIdentifier"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "proposedToIdentifier"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "responderDepositTokenAddress"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "initiatorDepositAssetId" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "initiatorIdentifier" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "responderIdentifier" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "responderDepositAssetId" text NOT NULL`, undefined);
        await queryRunner.query(`CREATE VIEW "anonymized_onchain_transaction" AS 
  SELECT
    "onchain_transaction"."createdAt" as "createdAt",
    "onchain_transaction"."reason" as "reason",
    "onchain_transaction"."value" as "value",
    "onchain_transaction"."gasPrice" as "gasPrice",
    "onchain_transaction"."gasLimit" as "gasLimit",
    "onchain_transaction"."to" as "to",
    "onchain_transaction"."from" as "from",
    "onchain_transaction"."hash" as "hash",
    "onchain_transaction"."data" as "data",
    "onchain_transaction"."nonce" as "nonce",
    encode(digest("channel"."userPublicIdentifier", 'sha256'), 'hex') as "publicIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"
  `, undefined);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","public","anonymized_onchain_transaction","SELECT\n    \"onchain_transaction\".\"createdAt\" as \"createdAt\",\n    \"onchain_transaction\".\"reason\" as \"reason\",\n    \"onchain_transaction\".\"value\" as \"value\",\n    \"onchain_transaction\".\"gasPrice\" as \"gasPrice\",\n    \"onchain_transaction\".\"gasLimit\" as \"gasLimit\",\n    \"onchain_transaction\".\"to\" as \"to\",\n    \"onchain_transaction\".\"from\" as \"from\",\n    \"onchain_transaction\".\"hash\" as \"hash\",\n    \"onchain_transaction\".\"data\" as \"data\",\n    \"onchain_transaction\".\"nonce\" as \"nonce\",\n    encode(digest(\"channel\".\"userPublicIdentifier\", 'sha256'), 'hex') as \"publicIdentifier\"\n  FROM \"onchain_transaction\"\n    LEFT JOIN \"channel\" ON \"channel\".\"id\" = \"onchain_transaction\".\"channelId\""]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["public","anonymized_onchain_transaction"]);
        await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "responderDepositAssetId"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "responderIdentifier"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "initiatorIdentifier"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "initiatorDepositAssetId"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "responderDepositTokenAddress" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "proposedToIdentifier" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "proposedByIdentifier" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "initiatorDepositTokenAddress" text NOT NULL`, undefined);
        await queryRunner.query(`CREATE VIEW "anonymized_onchain_transaction" AS SELECT
    "onchain_transaction"."createdAt" as "createdAt",
    "onchain_transaction"."reason" as "reason",
    "onchain_transaction"."value" as "value",
    "onchain_transaction"."gasPrice" as "gasPrice",
    "onchain_transaction"."gasLimit" as "gasLimit",
    "onchain_transaction"."to" as "to",
    "onchain_transaction"."from" as "from",
    "onchain_transaction"."hash" as "hash",
    "onchain_transaction"."data" as "data",
    "onchain_transaction"."nonce" as "nonce",
    encode(digest("channel"."userPublicIdentifier", 'sha256'), 'hex') as "channelIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"`, undefined);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","public","anonymized_onchain_transaction","SELECT\n    \"onchain_transaction\".\"createdAt\" as \"createdAt\",\n    \"onchain_transaction\".\"reason\" as \"reason\",\n    \"onchain_transaction\".\"value\" as \"value\",\n    \"onchain_transaction\".\"gasPrice\" as \"gasPrice\",\n    \"onchain_transaction\".\"gasLimit\" as \"gasLimit\",\n    \"onchain_transaction\".\"to\" as \"to\",\n    \"onchain_transaction\".\"from\" as \"from\",\n    \"onchain_transaction\".\"hash\" as \"hash\",\n    \"onchain_transaction\".\"data\" as \"data\",\n    \"onchain_transaction\".\"nonce\" as \"nonce\",\n    encode(digest(\"channel\".\"userPublicIdentifier\", 'sha256'), 'hex') as \"channelIdentifier\"\n  FROM \"onchain_transaction\"\n    LEFT JOIN \"channel\" ON \"channel\".\"id\" = \"onchain_transaction\".\"channelId\""]);
    }

}
