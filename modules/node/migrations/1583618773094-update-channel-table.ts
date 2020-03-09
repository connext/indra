import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChannelTable1583618773094 implements MigrationInterface {
  name = "UpdateStore1583618773094";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
        ADD COLUMN "schemaVersion" integer NOT NULL,
        ADD COLUMN "addresses" json NOT NULL,
        ADD COLUMN "singleAssetTwoPartyIntermediaryAgreements" json NOT NULL,
        ADD COLUMN "monotonicNumProposedApps" integer NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "conditional_transaction_commitment" 
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfee876dd"
        FOREIGN KEY ("appIdentityHash")
        REFERENCES "app_instance" ("identityHash");
    `);

    await queryRunner.query(`
      ALTER TABLE "set_state_commitment" 
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff873ee"
        FOREIGN KEY ("appIdentityHash")
        REFERENCES "app_instance" ("identityHash");
    `);

    await queryRunner.query(`
      ALTER TABLE "withdraw_commitment"
        ADD COLUMN "channelId" integer NOT NULL,
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfbb679ee"
        FOREIGN KEY ("channelId")
        REFERENCES "channel" ("id");
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
