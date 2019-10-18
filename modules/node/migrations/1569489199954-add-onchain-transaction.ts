import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnchainTransactions1569489199954 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE TYPE "transaction_reason_enum"
      AS ENUM('USER_WITHDRAWAL', 'COLLATERALIZATION', 'NODE_WITHDRAWAL')
    `);
    await queryRunner.query(`
      CREATE TABLE onchain_transaction (
        "id" SERIAL PRIMARY KEY,
        "reason" "transaction_reason_enum" NOT NULL,
        "value" text NOT NULL,
        "gasPrice" text NOT NULL,
        "gasLimit" text NOT NULL,
        "nonce" integer NOT NULL,
        "to" text NOT NULL,
        "from" text NOT NULL,
        "hash" text NOT NULL,
        "data" text NOT NULL,
        "v" integer NOT NULL,
        "r" text NOT NULL,
        "s" text NOT NULL,
        "channelId" integer REFERENCES channel(id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      DROP TYPE "transaction_reason_enum";
    `);
    await queryRunner.query(`
      DROP TABLE "onchain_transactions" CASCADE;
    `);
  }
}
