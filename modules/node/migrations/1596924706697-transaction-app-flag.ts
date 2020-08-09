import { MigrationInterface, QueryRunner } from "typeorm";
export class transactionAppFlag1596924706697 implements MigrationInterface {
  name = "transactionAppFlag1596924706697";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD COLUMN "appUninstalled" boolean NOT NULL DEFAULT 'false'`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP COLUMN "appUninstalled"`,
      undefined,
    );
  }
}
