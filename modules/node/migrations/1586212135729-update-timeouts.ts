import { MigrationInterface, QueryRunner } from "typeorm";

export class updateTimeouts1586212135729 implements MigrationInterface {
    name = "updateTimeouts1586212135729"

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "set_state_commitment" ADD COLUMN "stateTimeout" text`, undefined);
        await queryRunner.query(`ALTER TABLE "set_state_commitment" DROP COLUMN "timeout"`, undefined);
  
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "defaultTimeout" text NOT NULL DEFAULT '0x0'`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD "stateTimeout" text`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "latestTimeout"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "timeout"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_instance" DROP COLUMN "stateTimeout"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" RENAME COLUMN "defaultTimeout" TO "timeout"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_instance" ADD COLUMN "latestTimeout" integer NOT NULL`, undefined);

        await queryRunner.query(`ALTER TABLE "set_state_commitment" DROP COLUMN "stateTimeout"`, undefined);
        await queryRunner.query(`ALTER TABLE "set_state_commitment" ADD COLUMN "timeout" integer NOT NULL`, undefined);
    }

}
