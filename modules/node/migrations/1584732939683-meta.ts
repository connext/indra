import { MigrationInterface, QueryRunner } from "typeorm";

export class meta1584732939683 implements MigrationInterface {
  name = "meta1584732939683";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "meta" json`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "meta"`, undefined);
  }
}
