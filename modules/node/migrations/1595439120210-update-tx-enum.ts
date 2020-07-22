import { MigrationInterface, QueryRunner } from "typeorm";

export class updateTxEnum1595439120210 implements MigrationInterface {
  name = "updateTxEnum1595439120210";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_reason_enum" RENAME TO "transaction_reason_enum_old"`,
      undefined,
    );
    await queryRunner.query(`
      CREATE TYPE "transaction_reason_enum"
      AS ENUM('USER_WITHDRAWAL', 'COLLATERALIZATION', 'NODE_WITHDRAWAL', 'MULTISIG_DEPLOY')
    `);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "status" TYPE "transaction_reason_enum" USING "status"::"text"::"transaction_reason_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "transaction_reason_enum_old"`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_reason_enum" RENAME TO "transaction_reason_enum_old"`,
      undefined,
    );
    await queryRunner.query(`
      CREATE TYPE "transaction_reason_enum"
      AS ENUM('USER_WITHDRAWAL', 'COLLATERALIZATION', 'NODE_WITHDRAWAL')
    `);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "status" TYPE "transaction_reason_enum" USING "status"::"text"::"transaction_reason_enum"`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "transaction_reason_enum_old"`, undefined);
  }
}
