import { MigrationInterface, QueryRunner } from "typeorm";

export class initTransferTable1598039003043 implements MigrationInterface {
  name = "initTransferTable1598039003043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transfer" (
          "paymentId" text NOT NULL,
          "action" jsonb,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "receiverAppId" text,
          "senderAppId" text,
          CONSTRAINT "PK_49b59cbb23ef3605de4700cb5eb" PRIMARY KEY ("paymentId")
        )`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "transfer" ADD CONSTRAINT "FK_76dc9482640338f34e699253655" FOREIGN KEY ("receiverAppId") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "transfer" ADD CONSTRAINT "FK_76dc9487349338f34e699253655" FOREIGN KEY ("senderAppId") REFERENCES "app_instance"("identityHash") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer" DROP CONSTRAINT "FK_76dc9482640338f34e699253655"`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "transfer" DROP CONSTRAINT "FK_76dc9487349338f34e699253655"`,
      undefined,
    );

    await queryRunner.query(`DROP TABLE "transfer"`, undefined);
  }
}
