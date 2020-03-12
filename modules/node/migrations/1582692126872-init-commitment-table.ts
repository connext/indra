import { MigrationInterface, QueryRunner } from "typeorm";

export class InitCommitmentTable1582692126872 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE TABLE "conditional_transaction_commitment_entity" (
        "id" SERIAL PRIMARY KEY,
        "interpreterAddr" text NOT NULL,
        "interpreterParams" text NOT NULL,
        "multisigAddress" text NOT NULL,
        "freeBalanceAppIdentityHash" text NOT NULL,
        "multisigOwners" text[] NOT NULL,
        "signatures" json
      );

      CREATE TABLE "set_state_commitment_entity" (
        "id" SERIAL PRIMARY KEY,
        "appIdentity" json NOT NULL,
        "appStateHash" text NOT NULL,
        "challengeRegistryAddress" text NOT NULL,
        "signatures" json,
        "timeout" integer NOT NULL,
        "versionNumber" integer NOT NULL
      );

      CREATE TABLE "withdraw_commitment" (
        "id" SERIAL PRIMARY KEY,
        "to" text NOT NULL,
        "value" text NOT NULL,
        "data" text NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      DROP TABLE "conditional_transaction_commitment_entity";
      DROP TABLE "set_state_commitment_entity";
      DROP TABLE "withdraw_commitment";
    `);
  }
}
