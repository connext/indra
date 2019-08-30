import { MigrationInterface, QueryRunner } from "typeorm";

export class InitNodeRecords1567158660577 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE TABLE "node_records" (
        "path" character varying NOT NULL,
        "value" json NOT NULL,
        CONSTRAINT "PK_59679f33ec7b8a5f136be41943d"
        PRIMARY KEY ("path")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`DROP TABLE "node_records"`);
  }
}
