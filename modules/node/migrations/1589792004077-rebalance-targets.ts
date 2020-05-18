import { MigrationInterface, QueryRunner } from "typeorm";

export class rebalanceTargets1589792004077 implements MigrationInterface {
  name = "rebalanceTargets1589792004077";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" RENAME COLUMN "lowerBoundCollateralize" TO "collateralizeThreshold"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" RENAME COLUMN "upperBoundCollateralize" TO "target"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" RENAME COLUMN "upperBoundReclaim" TO "reclaimThreshold"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" DROP COLUMN "lowerBoundReclaim"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."challenge_status_enum" RENAME TO "challenge_status_enum_old"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "challenge_status_enum" AS ENUM('0', '1', '2', '3', '4', '5', '6')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ALTER COLUMN "status" TYPE "challenge_status_enum" USING "status"::"text"::"challenge_status_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "challenge_status_enum_old"`, undefined);
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
        'SELECT\n    "onchain_transaction"."createdAt" as "createdAt",\n    "onchain_transaction"."reason" as "reason",\n    "onchain_transaction"."value" as "value",\n    "onchain_transaction"."gasPrice" as "gasPrice",\n    "onchain_transaction"."gasLimit" as "gasLimit",\n    "onchain_transaction"."to" as "to",\n    "onchain_transaction"."from" as "from",\n    "onchain_transaction"."hash" as "hash",\n    "onchain_transaction"."data" as "data",\n    "onchain_transaction"."nonce" as "nonce",\n    encode(digest("channel"."userIdentifier", \'sha256\'), \'hex\') as "publicIdentifier"\n  FROM "onchain_transaction"\n    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(
      `CREATE TYPE "challenge_status_enum_old" AS ENUM('0', '1', '2', '3', '4')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ALTER COLUMN "status" TYPE "challenge_status_enum_old" USING "status"::"text"::"challenge_status_enum_old"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "challenge_status_enum"`, undefined);
    await queryRunner.query(
      `ALTER TYPE "challenge_status_enum_old" RENAME TO  "challenge_status_enum"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" DROP COLUMN "reclaimThreshold"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "rebalance_profile" DROP COLUMN "target"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" DROP COLUMN "collateralizeThreshold"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ADD "upperBoundReclaim" text NOT NULL DEFAULT '0'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ADD "lowerBoundReclaim" text NOT NULL DEFAULT '0'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ADD "upperBoundCollateralize" text NOT NULL DEFAULT '0'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ADD "lowerBoundCollateralize" text NOT NULL DEFAULT '0'`,
      undefined,
    );
  }
}
