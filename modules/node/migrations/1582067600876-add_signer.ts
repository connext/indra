import { MigrationInterface, QueryRunner } from "typeorm";

export class addSigner1582067600876 implements MigrationInterface {
  name = "addSigner1582067600876";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`ALTER TABLE "linked_transfer" ADD "signer" text NOT NULL`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`ALTER TABLE "linked_transfer" DROP COLUMN "signer"`, undefined);
  }
}
