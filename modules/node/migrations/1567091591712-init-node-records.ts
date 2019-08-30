import {MigrationInterface, QueryRunner} from "typeorm";

export class initNodeRecords1567091591712 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "node_records" ("key" character varying NOT NULL, "value" json NOT NULL, CONSTRAINT "PK_59679f33ec7b8a5f136be41943d" PRIMARY KEY ("key"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP TABLE "node_records"`);
    }

}
