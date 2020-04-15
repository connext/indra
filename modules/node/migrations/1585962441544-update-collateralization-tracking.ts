import { MigrationInterface, QueryRunner } from "typeorm";

export class updateCollateralizationTracking1585962441544 implements MigrationInterface {
    name = "updateCollateralizationTracking1585962441544"

    public async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "channel" ADD COLUMN "activeCollateralizations" json NOT NULL DEFAULT '{"0x0000000000000000000000000000000000000000":false}'`, undefined);

      await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "collateralizationInFlight"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "activeCollateralizations"`, undefined);

      await queryRunner.query(`ALTER TABLE "channel" ADD COLUMN "collateralizationInFlight" boolean NOT NULL DEFAULT false`, undefined);
    }

}
