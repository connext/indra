import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChannelTable1583618773094 implements MigrationInterface {
  name = "UpdateStore1583618773094";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
        ADD COLUMN "schemaVersion" integer NOT NULL,
        ADD COLUMN "addresses" json NOT NULL,
        ADD COLUMN "singleAssetTwoPartyIntermediaryAgreements" json array NOT NULL,
        ADD COLUMN "monotonicNumProposedApps" integer NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
        DROP COLUMN "schemaVersion",
        DROP COLUMN "addresses",
        DROP COLUMN "singleAssetTwoPartyIntermediaryAgreements",
        DROP COLUMN "monotonicNumProposedApps";
    `);
  }
}
