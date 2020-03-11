import {MigrationInterface, QueryRunner} from "typeorm";

export class withdraw1583917148573 implements MigrationInterface {
    name = 'withdraw1583917148573'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "withdraw" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "amount" text NOT NULL, "assetId" text NOT NULL, "recipient" text NOT NULL, "appInstanceId" text NOT NULL, "data" text NOT NULL, "withdrawerSignature" text NOT NULL, "counterpartySignature" text, "finalized" text NOT NULL, "channelId" integer, CONSTRAINT "PK_5c172f81689173f75bf5906ef22" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "withdraw" ADD CONSTRAINT "FK_819d296d9860dbfa2e553018272" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "withdraw" DROP CONSTRAINT "FK_819d296d9860dbfa2e553018272"`, undefined);
        await queryRunner.query(`DROP TABLE "withdraw"`, undefined);
    }

}
