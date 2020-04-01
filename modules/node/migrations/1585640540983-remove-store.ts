import { MigrationInterface, QueryRunner } from "typeorm";

export class removeStore1585640540983 implements MigrationInterface {
  name = "removeStore1585640540983";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "transfer"],
    );
    await queryRunner.query(`DROP VIEW "transfer"`, undefined);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_transfer"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_transfer"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel" ADD CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48" UNIQUE ("multisigAddress")`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "signatures"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "signatures" text array`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" DROP COLUMN "signatures"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "conditional_transaction_commitment" ADD "signatures" json`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "UQ_b0e29ab6bff34fb58e8fb63dd48"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE VIEW "anonymized_transfer" AS SELECT
    "peer_to_peer_transfer"."id"::TEXT as "paymentId",
    "peer_to_peer_transfer"."amount" as "amount",
    "peer_to_peer_transfer"."assetId" as "assetId",
    encode(digest("sender_channel"."userPublicIdentifier", 'sha256'), 'hex') as "senderChannelIdentifier",
    encode(digest("receiver_channel"."userPublicIdentifier", 'sha256'), 'hex') as "receiverChannelIdentifier",
    "peer_to_peer_transfer"."createdAt" as "createdAt",
    "peer_to_peer_transfer"."meta" as "meta",
    "peer_to_peer_transfer"."status"::TEXT as "status",
    'P2P' AS "type"
  FROM peer_to_peer_transfer
    LEFT JOIN "channel" "receiver_channel" ON "receiver_channel"."id" = "peer_to_peer_transfer"."receiverChannelId"
    LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "peer_to_peer_transfer"."senderChannelId"
  UNION ALL
  SELECT
    "linked_transfer"."paymentId" as "paymentId",
    "linked_transfer"."amount" as "amount",
    "linked_transfer"."assetId" as "assetId",
    encode(digest("sender_channel"."userPublicIdentifier", 'sha256'), 'hex') as "senderChannelIdentifier",
    encode(digest("receiver_channel"."userPublicIdentifier", 'sha256'), 'hex') as "receiverChannelIdentifier",
    "linked_transfer"."createdAt" as "createdAt",
    "linked_transfer"."meta" as "meta",
    "linked_transfer"."status"::TEXT as "status",
    'LINKED' AS "type"
  FROM linked_transfer
    LEFT JOIN "channel" "receiver_channel" ON "receiver_channel"."id" = "linked_transfer"."receiverChannelId"
    LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "linked_transfer"."senderChannelId";`,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "anonymized_transfer",
        'SELECT\n    "peer_to_peer_transfer"."id"::TEXT as "paymentId",\n    "peer_to_peer_transfer"."amount" as "amount",\n    "peer_to_peer_transfer"."assetId" as "assetId",\n    encode(digest("sender_channel"."userPublicIdentifier", \'sha256\'), \'hex\') as "senderChannelIdentifier",\n    encode(digest("receiver_channel"."userPublicIdentifier", \'sha256\'), \'hex\') as "receiverChannelIdentifier",\n    "peer_to_peer_transfer"."createdAt" as "createdAt",\n    "peer_to_peer_transfer"."meta" as "meta",\n    "peer_to_peer_transfer"."status"::TEXT as "status",\n    \'P2P\' AS "type"\n  FROM peer_to_peer_transfer\n    LEFT JOIN "channel" "receiver_channel" ON "receiver_channel"."id" = "peer_to_peer_transfer"."receiverChannelId"\n    LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "peer_to_peer_transfer"."senderChannelId"\n  UNION ALL\n  SELECT\n    "linked_transfer"."paymentId" as "paymentId",\n    "linked_transfer"."amount" as "amount",\n    "linked_transfer"."assetId" as "assetId",\n    encode(digest("sender_channel"."userPublicIdentifier", \'sha256\'), \'hex\') as "senderChannelIdentifier",\n    encode(digest("receiver_channel"."userPublicIdentifier", \'sha256\'), \'hex\') as "receiverChannelIdentifier",\n    "linked_transfer"."createdAt" as "createdAt",\n    "linked_transfer"."meta" as "meta",\n    "linked_transfer"."status"::TEXT as "status",\n    \'LINKED\' AS "type"\n  FROM linked_transfer\n    LEFT JOIN "channel" "receiver_channel" ON "receiver_channel"."id" = "linked_transfer"."receiverChannelId"\n    LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "linked_transfer"."senderChannelId";',
      ],
    );
    await queryRunner.query(
      `CREATE VIEW "transfer" AS SELECT
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
    LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";`,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "transfer",
        'SELECT\n    "fast_signed_transfer"."paymentId" as "paymentId",\n    "fast_signed_transfer"."amount" as "amount",\n    "fast_signed_transfer"."assetId" as "assetId",\n    "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",\n    "fast_signed_transfer"."createdAt" as "createdAt",\n    "fast_signed_transfer"."meta" as "meta",\n    "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",\n    "fast_signed_transfer"."status"::TEXT as "status",\n    \'FAST_SIGNED\' AS "type"\n  FROM fast_signed_transfer\n    LEFT JOIN channel receiver_channel ON receiver_channel.id = fast_signed_transfer."receiverChannelId"\n    LEFT JOIN channel sender_channel ON sender_channel.id = fast_signed_transfer."senderChannelId"\n  UNION ALL\n  SELECT\n    "linked_transfer"."paymentId" as "paymentId",\n    "linked_transfer"."amount" as "amount",\n    "linked_transfer"."assetId" as "assetId",\n    "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",\n    "linked_transfer"."createdAt" as "createdAt",\n    "linked_transfer"."meta" as "meta",\n    "linked_transfer"."recipientPublicIdentifier" as "receiverPublicIdentifier",\n    "linked_transfer"."status"::TEXT as "status",\n    \'LINKED\' AS "type"\n  FROM linked_transfer\n    LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"\n    LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";',
      ],
    );
  }
}
