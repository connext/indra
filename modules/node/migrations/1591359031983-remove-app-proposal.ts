import { MigrationInterface, QueryRunner } from "typeorm";

export class removeAppProposal1591359031983 implements MigrationInterface {
  name = "removeAppProposal1591359031983";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "initialState"`, undefined);
    await queryRunner.query(
      `UPDATE "app_instance" 
      SET "outcomeInterpreterParameters" = '{}' WHERE
      "outcomeInterpreterParameters" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" 
      ALTER COLUMN "outcomeInterpreterParameters" SET DEFAULT '{}',
      ALTER COLUMN "outcomeInterpreterParameters" SET NOT NULL`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "outcomeInterpreterParameters" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "nodeIdentifier" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "userIdentifier" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD "initialState" jsonb NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `CREATE VIEW "anonymized_onchain_transaction" AS SELECT
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
    encode(digest("channel"."userIdentifier", 'sha256'), 'hex') as "publicIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"`,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "anonymized_onchain_transaction",
        'SELECT\n    "onchain_transaction"."createdAt" as "createdAt",\n    "onchain_transaction"."reason" as "reason",\n    "onchain_transaction"."value" as "value",\n    "onchain_transaction"."gasPrice" as "gasPrice",\n    "onchain_transaction"."gasLimit" as "gasLimit",\n    "onchain_transaction"."to" as "to",\n    "onchain_transaction"."from" as "from",\n    "onchain_transaction"."hash" as "hash",\n    "onchain_transaction"."data" as "data",\n    "onchain_transaction"."nonce" as "nonce",\n    encode(digest("channel"."userIdentifier", \'sha256\'), \'hex\') as "publicIdentifier"\n  FROM "onchain_transaction"\n    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"',
      ],
    );
  }
}
