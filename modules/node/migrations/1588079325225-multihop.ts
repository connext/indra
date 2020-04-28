import { MigrationInterface, QueryRunner } from "typeorm";

export class multihop1588079325225 implements MigrationInterface {
  name = "multihop1588079325225";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "userIdentifier"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "nodeIdentifier"`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "nodeIdentifier" text`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" ADD "userIdentifier" text`, undefined);
  }
}
