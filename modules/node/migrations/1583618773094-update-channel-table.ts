import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChannelTable1583618773094 implements MigrationInterface {
  name = "UpdateStore1583618773094";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
        ADD COLUMN "schemaVersion" integer NOT NULL,
        ADD COLUMN "addresses" json NOT NULL,
        ADD COLUMN "setupCommitmentId" integer,
        ADD CONSTRAINT "PK_3cd3fd3cc74b86faf8bfbb679ee"
        FOREIGN KEY ("setupCommitmentId")
        REFERENCES "setup_commitment_entity" ("id"),
        ADD COLUMN "monotonicNumProposedApps" integer NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "conditional_transaction_commitment_entity" 
        ADD COLUMN "appId" integer,
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfee876dd"
        FOREIGN KEY ("appId")
        REFERENCES "app_instance" ("id");
    `);

    await queryRunner.query(`
      ALTER TABLE "set_state_commitment_entity" 
        ADD COLUMN "appId" integer,
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff873ee"
        FOREIGN KEY ("appId")
        REFERENCES "app_instance" ("id");
    `);

    await queryRunner.query(`
      ALTER TABLE "withdraw_commitment"
        ADD COLUMN "channelId" integer NOT NULL,
        ADD CONSTRAINT "PK_5bb6fd3cc74b86faf8bfbb679ee"
        FOREIGN KEY ("channelId")
        REFERENCES "channel" ("id");
    `);

    await queryRunner.query(`
      ALTER TABLE "setup_commitment_entity"
        ADD COLUMN "channelId" integer NOT NULL,
        ADD CONSTRAINT "PK_3ce5fd3cc74b86faf8bfbb679ee"
        FOREIGN KEY ("channelId")
        REFERENCES "channel" ("id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "channel"
        DROP COLUMN "schemaVersion",
        DROP COLUMN "addresses",
        DROP COLUMN "setupCommitmentId",
        DROP COLUMN "monotonicNumProposedApps",
        DROP CONSTRAINT "PK_3cd3fd3cc74b86faf8bfbb679ee";
    `);

    await queryRunner.query(`
      ALTER TABLE "conditional_transaction_commitment_entity"
        DROP CONSTRAINT "PK_5bb6fd3cc74b86faf8bfee876dd";
    `);
    await queryRunner.query(`
      ALTER TABLE "set_state_commitment_entity"
        DROP CONSTRAINT "PK_5bb6fd3cc74b86faf8bfff873ee";
    `);
    await queryRunner.query(`
      ALTER TABLE "withdraw_commitment"
        DROP CONSTRAINT "PK_5bb6fd3cc74b86faf8bfbb679ee";
    `);

    await queryRunner.query(`
      ALTER TABLE "setup_commitment_entity"
        DROP CONSTRAINT "PK_3ce5fd3cc74b86faf8bfbb679ee";
    `);
  }
}
