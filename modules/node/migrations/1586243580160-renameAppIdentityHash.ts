import {MigrationInterface, QueryRunner} from "typeorm";

export class renameAppIdentityHash1586243580160 implements MigrationInterface {
    name = 'renameAppIdentityHash1586243580160'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "withdraw" RENAME COLUMN "appInstanceId" TO "appIdentityHash"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "withdraw" RENAME COLUMN "appIdentityHash" TO "appInstanceId"`, undefined);
    }

}
