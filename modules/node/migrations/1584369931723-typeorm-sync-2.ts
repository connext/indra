import { MigrationInterface, QueryRunner } from "typeorm";

export class typeormSync21584369931723 implements MigrationInterface {
  name = "typeormSync21584369931723";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" SET DEFAULT nextval('rebalance_profile_id_seq')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0" FOREIGN KEY ("rebalanceProfileId") REFERENCES "rebalance_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(`DROP SEQUENCE "rebalance_profile_id_seq"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0" FOREIGN KEY ("rebalanceProfileId") REFERENCES "rebalance_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
  }
}
