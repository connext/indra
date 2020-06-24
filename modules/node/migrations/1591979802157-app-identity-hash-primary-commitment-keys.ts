import { MigrationInterface, QueryRunner } from "typeorm";

export class appIdentityHashPrimaryCommitmentKeys1591979802157 implements MigrationInterface {
  name = "appIdentityHashPrimaryCommitmentKeys1591979802157";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "PK_678676ce94a1b8426e05fd802ed"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "id"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "PK_b64d8b0a8c30a8df8c63ad511f4"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "set_state_commitment" DROP COLUMN "id"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "outcomeInterpreterParameters" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "FK_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ALTER COLUMN "appIdentityHash" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "PK_e0e92322fb954102944db1889c6" PRIMARY KEY ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "appIdentityHash" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "PK_7ea341dca81a2105ce9f6d2d83d" PRIMARY KEY ("appIdentityHash")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "FK_e0e92322fb954102944db1889c6" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
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
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "FK_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP CONSTRAINT "PK_7ea341dca81a2105ce9f6d2d83d"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "appIdentityHash" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "FK_7ea341dca81a2105ce9f6d2d83d" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP CONSTRAINT "PK_e0e92322fb954102944db1889c6"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ALTER COLUMN "appIdentityHash" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "FK_e0e92322fb954102944db1889c6" FOREIGN KEY ("appIdentityHash") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "outcomeInterpreterParameters" SET DEFAULT '{}'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "id" SERIAL NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD CONSTRAINT "PK_b64d8b0a8c30a8df8c63ad511f4" PRIMARY KEY ("id")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "id" SERIAL NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD CONSTRAINT "PK_678676ce94a1b8426e05fd802ed" PRIMARY KEY ("id")`,
      undefined,
    );
  }
}
