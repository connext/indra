import {MigrationInterface, QueryRunner} from "typeorm";

export class withdraw1583937670139 implements MigrationInterface {
    name = 'withdraw1583937670139'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "withdraw" ADD "onchainTransactionId" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "withdraw" ADD CONSTRAINT "UQ_fe366fd9823feea6af8ad157176" UNIQUE ("onchainTransactionId")`, undefined);
        await queryRunner.query(`ALTER TABLE "withdraw" ADD CONSTRAINT "FK_fe366fd9823feea6af8ad157176" FOREIGN KEY ("onchainTransactionId") REFERENCES "onchain_transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "withdraw" DROP CONSTRAINT "FK_fe366fd9823feea6af8ad157176"`, undefined);
        await queryRunner.query(`ALTER TABLE "withdraw" DROP CONSTRAINT "UQ_fe366fd9823feea6af8ad157176"`, undefined);
        await queryRunner.query(`ALTER TABLE "withdraw" DROP COLUMN "onchainTransactionId"`, undefined);
    }

}
