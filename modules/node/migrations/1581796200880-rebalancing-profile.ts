import { MigrationInterface, QueryRunner } from "typeorm";

export class RebalancingProfile1581796200880 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "payment_profile" RENAME COLUMN "minimumMaintainedCollateral" TO "lowerBoundCollateralize";
      ALTER TABLE "payment_profile" RENAME COLUMN "amountToCollateralize" TO "upperBoundCollateralize";
      ALTER TABLE "payment_profile" ADD COLUMN "lowerBoundReclaim" text NOT NULL DEFAULT '0'::text;
      ALTER TABLE "payment_profile" ADD COLUMN "upperBoundReclaim" text NOT NULL DEFAULT '0'::text;
      ALTER TABLE "payment_profile" RENAME TO "rebalance_profile";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(``);
    await queryRunner.query(`
      ALTER TABLE "rebalance_profile" RENAME TO "payment_profile";
      ALTER TABLE "payment_profile" RENAME COLUMN "lowerBoundCollateralize" TO "minimumMaintainedCollateral";
      ALTER TABLE "payment_profile" RENAME COLUMN "upperBoundCollateralize" TO "amountToCollateralize";
      ALTER TABLE "payment_profile" DROP COLUMN "lowerBoundReclaim";
      ALTER TABLE "payment_profile" DROP COLUMN "upperBoundReclaim";
    `);
  }
}
