import { MigrationInterface, QueryRunner } from "typeorm";

export class dropIdentifiers1592148854323 implements MigrationInterface {
  name = "dropIdentifiers1592148854323";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "userIdentifier"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "nodeIdentifier"`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD COLUMN "nodeIdentifier" TEXT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD COLUMN "userIdentifier" TEXT`,
      undefined,
    );
  }
}
