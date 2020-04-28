import { MigrationInterface, QueryRunner } from "typeorm";

export class initWatcherMethods1587505874044 implements MigrationInterface {
  name = "initWatcherMethods1587505874044";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "state_progressed_event" ("id" SERIAL NOT NULL, "action" jsonb NOT NULL, "versionNumber" text NOT NULL, "timeout" text NOT NULL, "turnTaker" text NOT NULL, "signature" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "challengeId" integer, CONSTRAINT "PK_49b59cbb23fa5045de4700cb5eb" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "challenge_updated_event_status_enum" AS ENUM('0', '1', '2', '3', '4')`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "challenge_updated_event" ("id" SERIAL NOT NULL, "appStateHash" text NOT NULL, "versionNumber" text NOT NULL, "finalizesAt" text NOT NULL, "status" "challenge_updated_event_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "challengeId" integer, CONSTRAINT "PK_cdced0c55c9716fdeb89f166ebe" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "processed_block" ("blockNumber" integer NOT NULL, CONSTRAINT "PK_5a97e50cbe8768622d52ac79916" PRIMARY KEY ("blockNumber"))`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "challenge_status_enum" AS ENUM('0', '1', '2', '3', '4')`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "challenge" ("id" SERIAL NOT NULL, "versionNumber" text NOT NULL, "appStateHash" text NOT NULL, "finalizesAt" text NOT NULL, "status" "challenge_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "appId" integer, "channelId" integer, CONSTRAINT "REL_0fa6c5f8f54fc3b5f94bd80fe3" UNIQUE ("appId"), CONSTRAINT "PK_5f31455ad09ea6a836a06871b7a" PRIMARY KEY ("id"))`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "state_progressed_event" ADD CONSTRAINT "FK_76dc9486095338f34e699253655" FOREIGN KEY ("challengeId") REFERENCES "challenge"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge_updated_event" ADD CONSTRAINT "FK_5b08bba1c06251ad4faa8e68230" FOREIGN KEY ("challengeId") REFERENCES "challenge"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_0fa6c5f8f54fc3b5f94bd80fe3c" FOREIGN KEY ("appId") REFERENCES "app_instance"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" ADD CONSTRAINT "FK_f61a56ed1169fe59fd019cf284e" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_f61a56ed1169fe59fd019cf284e"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge" DROP CONSTRAINT "FK_0fa6c5f8f54fc3b5f94bd80fe3c"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "challenge_updated_event" DROP CONSTRAINT "FK_5b08bba1c06251ad4faa8e68230"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "state_progressed_event" DROP CONSTRAINT "FK_76dc9486095338f34e699253655"`,
      undefined,
    );
    await queryRunner.query(`DROP TABLE "challenge"`, undefined);
    await queryRunner.query(`DROP TYPE "challenge_status_enum"`, undefined);
    await queryRunner.query(`DROP TABLE "processed_block"`, undefined);
    await queryRunner.query(`DROP TABLE "challenge_updated_event"`, undefined);
    await queryRunner.query(`DROP TYPE "challenge_updated_event_status_enum"`, undefined);
    await queryRunner.query(`DROP TABLE "state_progressed_event"`, undefined);
  }
}
