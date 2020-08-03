import { MigrationInterface, QueryRunner } from "typeorm";

export class txDataToCommitments1594196149518 implements MigrationInterface {
  name = "txDataToCommitments1594196149518";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "transactionData" text`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "conditional_transaction_commitment" SET "transactionData" = '0x' WHERE "transactionData" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ALTER COLUMN "transactionData" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "transactionData" text`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "set_state_commitment" SET "transactionData" = '0x' WHERE "transactionData" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "transactionData" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET DEFAULT '{"_hex":"0x00","_isBigNumber":true}'`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "onchain_transaction" SET "gasUsed" = '{"_hex":"0x00","_isBigNumber":true}' WHERE "gasUsed" IS NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET NOT NULL`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET DEFAULT '0'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP COLUMN "transactionData"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "transactionData"`,
      undefined,
    );
  }
}
