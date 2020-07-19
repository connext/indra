import { MigrationInterface, QueryRunner } from "typeorm";

export class updateOnchain1594840136529 implements MigrationInterface {
  name = "updateOnchain1594840136529";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ALTER COLUMN "hash" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD CONSTRAINT "UQ_32e4d3e9bce4339a85b9f0f1e27" UNIQUE ("hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD COLUMN "chainId" text`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET DEFAULT '{"_hex":"0x00","_isBigNumber":true}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP CONSTRAINT "UQ_32e4d3e9bce4339a85b9f0f1e27"`,
    );
    await queryRunner.query(`ALTER TABLE "onchain_transaction" ALTER COLUMN "hash" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "chainId"`, undefined);
  }
}
