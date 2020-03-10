import { MigrationInterface, QueryRunner } from "typeorm";

export class fastSignedTransfer1583682931763 implements MigrationInterface {
  name = "fastSignedTransfer1583682931763";

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `CREATE TYPE "fast_signed_transfer_status_enum" AS ENUM(
        'PENDING', 'REDEEMED', 'FAILED', 'RECLAIMED'
      )`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TABLE "fast_signed_transfer" (
        "id" SERIAL NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "amount" text NOT NULL, 
        "assetId" text NOT NULL, 
        "senderAppInstanceId" text NOT NULL, 
        "receiverAppInstanceId" text, 
        "paymentId" text NOT NULL, "signer" text, 
        "data" text, 
        "signature" text, 
        "status" "fast_signed_transfer_status_enum" NOT NULL DEFAULT 'PENDING', 
        "meta" json, 
        "senderChannelId" integer, 
        "receiverChannelId" integer, 
        CONSTRAINT "PK_17507a85ecaeebcc271867f8b5e" PRIMARY KEY ("id")
      )`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `ALTER TABLE "fast_signed_transfer" DROP CONSTRAINT "FK_7453a8824314cdf9dba2fb4c3a2"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fast_signed_transfer" DROP CONSTRAINT "FK_fe3554e11b1fda0bca0f3fcabfe"`,
      undefined,
    );

    await queryRunner.query(`DROP TABLE "fast_signed_transfer"`, undefined);
    await queryRunner.query(`DROP TYPE "fast_signed_transfer_status_enum"`, undefined);
  }
}
