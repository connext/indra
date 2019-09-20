import { MigrationInterface, QueryRunner } from "typeorm";

// https://blog.yo1.dog/updating-enum-values-in-postgresql-the-safe-and-easy-way
export class AddReclaimedLinks1568746114079 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    // rename the existing type
    await queryRunner.query(`
      ALTER TYPE "linked_transfer_status_enum"
      RENAME TO "linked_transfer_status_enum_old"
    `);
    // create the new type
    await queryRunner.query(`
      CREATE TYPE "linked_transfer_status_enum"
      AS ENUM('PENDING', 'CREATED', 'REDEEMED', 'FAILED', 'RECLAIMED')
    `);
    // drop the column default for now: // https://stackoverflow.com/q/31567599
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ALTER COLUMN "status" DROP DEFAULT
    `);
    // update the columns to use the new type + new default
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ALTER COLUMN "status" SET DEFAULT 'PENDING',
      ALTER COLUMN "status" SET NOT NULL,
      ALTER COLUMN "status"
        TYPE "linked_transfer_status_enum"
        USING status::text::linked_transfer_status_enum
    `);
    // remove the old type
    await queryRunner.query(`
      DROP TYPE linked_transfer_status_enum_old
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    // rename the existing type
    await queryRunner.query(`
      ALTER TYPE "linked_transfer_status_enum"
      RENAME TO "linked_transfer_status_enum_old"
    `);
    // create the new type
    await queryRunner.query(`
      CREATE TYPE "linked_transfer_status_enum"
      AS ENUM('PENDING', 'CREATED', 'REDEEMED', 'FAILED')
    `);
    // drop the column default for now: // https://stackoverflow.com/q/31567599
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ALTER COLUMN "status" DROP DEFAULT
    `);
    // update the columns to use the new type + new default
    await queryRunner.query(`
      ALTER TABLE "linked_transfer"
      ALTER COLUMN "status" SET DEFAULT 'PENDING',
      ALTER COLUMN "status" SET NOT NULL,
      ALTER COLUMN "status"
        TYPE "linked_transfer_status_enum"
        USING status::text::linked_transfer_status_enum
    `);
    // remove the old type
    await queryRunner.query(`
      DROP TYPE linked_transfer_status_enum_old
    `);
  }
}
