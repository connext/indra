import { MigrationInterface, QueryRunner } from "typeorm";

export class jsonb1585828108215 implements MigrationInterface {
  name = "jsonb1585828108215";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channel" ALTER COLUMN "addresses" TYPE jsonb`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "initialState" TYPE jsonb`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "latestState" TYPE jsonb`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_instance" ALTER COLUMN "meta" TYPE jsonb`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "outcomeInterpreterParameters" TYPE jsonb`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "appIdentity" TYPE jsonb`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "signatures" TYPE jsonb`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channel" ALTER COLUMN "addresses" TYPE json`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "initialState" TYPE json`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "latestState" TYPE json`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_instance" ALTER COLUMN "meta" TYPE json`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_instance" ALTER COLUMN "outcomeInterpreterParameters" TYPE json`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "appIdentity" TYPE json`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "set_state_commitment" ALTER COLUMN "signatures" TYPE json`,
      undefined,
    );
  }
}
