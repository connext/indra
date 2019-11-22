import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCfcoreTimestamps1574451273832 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE node_records
      ADD COLUMN "createdAt" timestamp,
      ADD COLUMN "updatedAt" timestamp;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE node_records
      DROP COLUMN "createdAt",
      DROP COLUMN "updatedAt";
    `);
  }
}
