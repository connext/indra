import { MigrationInterface, QueryRunner } from "typeorm";
export class addAppIdTx1596488084652 implements MigrationInterface {
  name = "addAppIdTx1596488084652";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "appIdentityHash" text`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP COLUMN "appIdentityHash"`,
      undefined,
    );
  }
}
