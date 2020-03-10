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
    await queryRunner.query(
      `DROP VIEW "transfer";
      CREATE OR REPLACE VIEW "transfer" AS
      SELECT
        "fast_signed_transfer"."paymentId" as "paymentId",
        "fast_signed_transfer"."amount" as "amount",
        "fast_signed_transfer"."assetId" as "assetId",
        "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
        "fast_signed_transfer"."createdAt" as "createdAt",
        "fast_signed_transfer"."meta" as "meta",
        "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
        "fast_signed_transfer"."status"::TEXT as "status",
        'FAST_SIGNED' AS "type"
      FROM fast_signed_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = fast_signed_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = fast_signed_transfer."senderChannelId"
      UNION ALL
      SELECT
        "linked_transfer"."paymentId" as "paymentId",
        "linked_transfer"."amount" as "amount",
        "linked_transfer"."assetId" as "assetId",
        "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
        "linked_transfer"."createdAt" as "createdAt",
        "linked_transfer"."meta" as "meta",
        "linked_transfer"."recipientPublicIdentifier" as "receiverPublicIdentifier",
        "linked_transfer"."status"::TEXT as "status",
        'LINKED' AS "type"
      FROM linked_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";
      `,
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

    await queryRunner.query(`
      DROP VIEW transfer;

      CREATE OR REPLACE VIEW transfer AS
      SELECT
        "peer_to_peer_transfer"."id"::TEXT as "paymentId",
        "peer_to_peer_transfer"."amount" as "amount",
        "peer_to_peer_transfer"."assetId" as "assetId",
        "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
        "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
        "peer_to_peer_transfer"."createdAt" as "createdAt",
        "peer_to_peer_transfer"."meta" as "meta",
        "peer_to_peer_transfer"."status"::TEXT as "status",
        'P2P' AS "type"
      FROM peer_to_peer_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = peer_to_peer_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = peer_to_peer_transfer."senderChannelId"
      UNION ALL
      SELECT
        "linked_transfer"."paymentId" as "paymentId",
        "linked_transfer"."amount" as "amount",
        "linked_transfer"."assetId" as "assetId",
        "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
        "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
        "linked_transfer"."createdAt" as "createdAt",
        "linked_transfer"."meta" as "meta",
        "linked_transfer"."status"::TEXT as "status",
        'LINKED' AS "type"
      FROM linked_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";
    `);
  }
}
