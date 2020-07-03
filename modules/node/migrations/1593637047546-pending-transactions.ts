import { MigrationInterface, QueryRunner } from "typeorm";

export class pendingTransactions1593637047546 implements MigrationInterface {
  name = "pendingTransactions1593637047546";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "v"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "r"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "s"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "status" text`, undefined);
    await queryRunner.query(
      `UPDATE "onchain_transaction" SET "status" = 'PENDING' WHERE "status" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "status" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "blockNumber" integer`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "blockHash" text`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "raw" text `, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "gasUsed" text`, undefined);
    await queryRunner.query(
      `UPDATE "onchain_transaction" SET "gasUsed" = '0' WHERE "gasUsed" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET DEFAULT '0'`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "logsBloom" text`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "errors" jsonb`, undefined);
    await queryRunner.query(
      `CREATE VIEW "anonymized_onchain_transaction" AS 
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
    "onchain_transaction"."status" as "status",
    "onchain_transaction"."gasUsed" as "gasUsed",
    encode(digest("channel"."userIdentifier", 'sha256'), 'hex') as "publicIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"
  `,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "anonymized_onchain_transaction",
        'SELECT\n    "onchain_transaction"."createdAt" as "createdAt",\n    "onchain_transaction"."reason" as "reason",\n    "onchain_transaction"."value" as "value",\n    "onchain_transaction"."gasPrice" as "gasPrice",\n    "onchain_transaction"."gasLimit" as "gasLimit",\n    "onchain_transaction"."to" as "to",\n    "onchain_transaction"."from" as "from",\n    "onchain_transaction"."hash" as "hash",\n    "onchain_transaction"."data" as "data",\n    "onchain_transaction"."nonce" as "nonce",\n    "onchain_transaction"."status" as "status",\n    "onchain_transaction"."gasUsed" as "gasUsed",\n    encode(digest("channel"."userIdentifier", \'sha256\'), \'hex\') as "publicIdentifier"\n  FROM "onchain_transaction"\n    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "errors"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "logsBloom"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "gasUsed"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "raw"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "blockHash"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP COLUMN "blockNumber"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "status"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "s" text NOT NULL`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "r" text NOT NULL`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "v" integer NOT NULL`,
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
    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"`,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "anonymized_onchain_transaction",
        'SELECT\n    "onchain_transaction"."createdAt" as "createdAt",\n    "onchain_transaction"."reason" as "reason",\n    "onchain_transaction"."value" as "value",\n    "onchain_transaction"."gasPrice" as "gasPrice",\n    "onchain_transaction"."gasLimit" as "gasLimit",\n    "onchain_transaction"."to" as "to",\n    "onchain_transaction"."from" as "from",\n    "onchain_transaction"."hash" as "hash",\n    "onchain_transaction"."data" as "data",\n    "onchain_transaction"."nonce" as "nonce",\n    encode(digest("channel"."userIdentifier", \'sha256\'), \'hex\') as "publicIdentifier"\n  FROM "onchain_transaction"\n    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"',
      ],
    );
  }
}
