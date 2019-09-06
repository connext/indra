import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCollateralizationInFlight1567601573372 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
      RENAME COLUMN "depositInFlight" TO "collateralizationInFlight"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
      RENAME COLUMN "collateralizationInFlight" TO "depositInFlight"
    `);
  }
}
