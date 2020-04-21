import { MigrationInterface, QueryRunner } from "typeorm";

export class addLatestAction1587492602160 implements MigrationInterface {
  name = "addLatestAction1587492602160";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "latestAction" jsonb`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "latestAction"`, undefined);
  }
}
