import { MigrationInterface, QueryRunner } from "typeorm";

export class NetworkToChainId1579686361011 implements MigrationInterface {
  name = "NetworkToChainId1579686361011";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `ALTER TABLE "app_registry" RENAME COLUMN "network" TO "chainId"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."app_registry_network_enum" RENAME TO "app_registry_chainid_enum"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_registry" ADD "oldNetwork" text`, undefined);
    await queryRunner.query(`UPDATE "app_registry" SET "oldNetwork" = "chainId"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "chainId"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_registry" ADD "chainId" integer`, undefined);

    await queryRunner.query(
      `UPDATE "app_registry" SET "chainId" = 1 WHERE "oldNetwork" = 'homestead'`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "app_registry" SET "chainId" = 4 WHERE "oldNetwork" = 'rinkeby'`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "app_registry" SET "chainId" = 1337 WHERE "oldNetwork" = 'ganache'`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_registry" ALTER COLUMN "chainId" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "oldNetwork"`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `ALTER TABLE "app_registry" RENAME COLUMN "chainId" TO "network"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."app_registry_chainid_enum" RENAME TO "app_registry_network_enum"`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_registry" ADD "oldChainId" text`, undefined);
    await queryRunner.query(`UPDATE "app_registry" SET "oldChainId" = "network"`, undefined);
    await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "network"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "app_registry" ADD "network" app_registry_network_enum`,
      undefined,
    );

    await queryRunner.query(
      `UPDATE "app_registry" SET "network" = 'homestead' WHERE "oldChainId" = 1`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "app_registry" SET "network" = 'rinkeby' WHERE "oldChainId" = 4`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "app_registry" SET "network" = 'ganache' WHERE "oldChainId" = 1337`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_registry" ALTER COLUMN "network" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "oldChainId"`, undefined);
  }
}
