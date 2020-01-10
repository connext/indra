import { MigrationInterface, QueryRunner } from "typeorm";

export class EditViewTable1578621554000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
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

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      DROP VIEW transfer;

      CREATE OR REPLACE VIEW transfer AS
      SELECT
        peer_to_peer_transfer.id,
        peer_to_peer_transfer.amount,
        peer_to_peer_transfer."assetId",
        peer_to_peer_transfer."meta",
        peer_to_peer_transfer."createdAt" as "createdAt",
        sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
        receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
      FROM peer_to_peer_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = peer_to_peer_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = peer_to_peer_transfer."senderChannelId"
      UNION ALL
      SELECT linked_transfer.id,
        linked_transfer.amount,
        linked_transfer."assetId",
        linked_transfer."meta",
        linked_transfer."createdAt",
        sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
        receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
      FROM linked_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";
    `);
  }
}
