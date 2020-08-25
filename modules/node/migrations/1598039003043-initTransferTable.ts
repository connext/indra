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
          "receiverAppIdentityHash" text,
          "senderAppIdentityHash" text,
          CONSTRAINT "PK_49b59cbb23ef3605de4700cb5eb" PRIMARY KEY ("paymentId")
        )`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "transfer" 
      ADD CONSTRAINT "FK_76dc9482640338f34e699253655" 
        FOREIGN KEY ("receiverAppIdentityHash") 
        REFERENCES "app_instance"("identityHash") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "transfer" 
      ADD CONSTRAINT "FK_76dc9487349338f34e699253655" 
        FOREIGN KEY ("senderAppIdentityHash") 
        REFERENCES "app_instance"("identityHash") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_instance" ADD COLUMN "transferPaymentId" text`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_instance" 
      ADD CONSTRAINT "FK_76dc9488490367f34e699253655" 
        FOREIGN KEY ("transferPaymentId") 
        REFERENCES "transfer"("paymentId") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE`,
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

    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP CONSTRAINT "FK_76dc9488490367f34e699253655"`,
      undefined,
    );

    await queryRunner.query(
      `ALTER TABLE "app_instance" DROP COLUMN "transferPaymentId"`,
      undefined,
    );

    await queryRunner.query(`DROP TABLE "transfer"`, undefined);
  }
}
