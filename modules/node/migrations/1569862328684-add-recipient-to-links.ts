import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipientToLinks1569862328684 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE linked_transfer
        ADD COLUMN "recipientPublicIdentifier" text,
        ADD COLUMN "encryptedPreImage" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE linked_transfer
        DROP COLUMN "recipientPublicIdentifier",
        DROP COLUMN "encryptedPreImage"
    `);
  }
}
