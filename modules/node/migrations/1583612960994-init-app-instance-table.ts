import { MigrationInterface, QueryRunner } from "typeorm";

export class InitAppInstanceTable1583612960994 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE TYPE "app_instance_type_enum"
        AS ENUM('PROPOSAL', 'INSTANCE', 'FREE_BALANCE');
    `);

    await queryRunner.query(
      `CREATE TABLE "app_instance" (
        "id" SERIAL PRIMARY KEY,
        "type" "app_instance_type_enum" NOT NULL,
        "appDefinition" text NOT NULL,
        "abiEncodings" json NOT NULL,
        "appSeqNo" integer NOT NULL,
        "identityHash" text NOT NULL UNIQUE,
        "initialState" json NOT NULL,
        "latestState" json NOT NULL,
        "latestTimeout" integer NOT NULL,
        "latestVersionNumber" integer NOT NULL,
        "initiatorDeposit" text NOT NULL,
        "initiatorDepositTokenAddress" text NOT NULL,
        "outcomeType" "app_registry_outcometype_enum" NOT NULL,
        "proposedByIdentifier" text NOT NULL,
        "proposedToIdentifier" text NOT NULL,
        "responderDeposit" text NOT NULL,
        "responderDepositTokenAddress" text NOT NULL,
        "timeout" text NOT NULL,
        "participants" json,
        "twoPartyOutcomeInterpreterParams" json, "multiAssetMultiPartyCoinTransferInterpreterParams" json, "singleAssetTwoPartyCoinTransferInterpreterParams" json,
        "channelId" integer
      );`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "app_instance" DROP CONSTRAINT "FK_eb520fb97e9e4ede0af147cff27";
      DROP TABLE "app_instance";
      DROP TYPE "app_instance_type_enum";
    `);
  }
}
