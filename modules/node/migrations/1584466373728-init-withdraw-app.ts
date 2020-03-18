import { MigrationInterface, QueryRunner } from "typeorm";

export class initWithdrawApp1584466373728 implements MigrationInterface {
  name = "initWithdrawApp1584466373728";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "withdraw" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "amount" text NOT NULL, "assetId" text NOT NULL, "recipient" text NOT NULL, "appInstanceId" text NOT NULL, "data" text NOT NULL, "withdrawerSignature" text NOT NULL, "counterpartySignature" text, "finalized" text NOT NULL, "channelId" integer, "onchainTransactionId" integer, CONSTRAINT "REL_fe366fd9823feea6af8ad15717" UNIQUE ("onchainTransactionId"), CONSTRAINT "PK_5c172f81689173f75bf5906ef22" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" ADD CONSTRAINT "FK_819d296d9860dbfa2e553018272" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" ADD CONSTRAINT "FK_fe366fd9823feea6af8ad157176" FOREIGN KEY ("onchainTransactionId") REFERENCES "onchain_transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP CONSTRAINT "FK_fe366fd9823feea6af8ad157176"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "withdraw" DROP CONSTRAINT "FK_819d296d9860dbfa2e553018272"`,
      undefined,
    );
    await queryRunner.query(`DROP TABLE "withdraw"`, undefined);
  }
}
