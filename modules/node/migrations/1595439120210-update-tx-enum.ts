import { MigrationInterface, QueryRunner } from "typeorm";

export class updateTxEnum1595439120210 implements MigrationInterface {
  name = "updateTxEnum1595439120210";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear view to alter enum
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);

    await queryRunner.query(
      `ALTER TYPE "public"."transaction_reason_enum" RENAME TO "transaction_reason_enum_old"`,
      undefined,
    );
    await queryRunner.query(`
      CREATE TYPE "transaction_reason_enum"
      AS ENUM('USER_WITHDRAWAL', 'COLLATERALIZATION', 'NODE_WITHDRAWAL', 'MULTISIG_DEPLOY')
    `);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "reason" TYPE "transaction_reason_enum" USING "reason"::"text"::"transaction_reason_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "transaction_reason_enum_old"`, undefined);

    // Revive view
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
    // Clear view to alter enum
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);

    await queryRunner.query(
      `ALTER TYPE "public"."transaction_reason_enum" RENAME TO "transaction_reason_enum_old"`,
      undefined,
    );
    await queryRunner.query(`
      CREATE TYPE "transaction_reason_enum"
      AS ENUM('USER_WITHDRAWAL', 'COLLATERALIZATION', 'NODE_WITHDRAWAL')
    `);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "reason" TYPE "transaction_reason_enum" USING "reason"::"text"::"transaction_reason_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "transaction_reason_enum_old"`, undefined);

    // Revive view
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
}
