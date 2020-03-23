import { MigrationInterface, QueryRunner } from "typeorm";

export class createdUpdated1584722683650 implements MigrationInterface {
  name = "createdUpdated1584722683650";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP COLUMN "updatedAt"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" DROP COLUMN "createdAt"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "updatedAt"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "createdAt"`, undefined);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "updatedAt"`, undefined);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "createdAt"`, undefined);
  }
}
