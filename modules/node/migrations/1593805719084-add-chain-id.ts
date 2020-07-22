import { MigrationInterface, QueryRunner } from "typeorm";

export class addChainId1593805719084 implements MigrationInterface {
  name = "addChainId1593805719084";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channel" ADD "chainId" integer`, undefined);
    await queryRunner.query(`UPDATE "channel" SET "chainId" = 0`, undefined);
    await queryRunner.query(`ALTER TABLE "channel" ALTER COLUMN "chainId" SET NOT NULL`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "gasUsed" SET DEFAULT '{"_hex":"0x00","_isBigNumber":true}'`,
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
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "chainId"`, undefined);
  }
}
