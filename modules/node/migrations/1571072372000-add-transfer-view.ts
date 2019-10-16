import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransferView1571072372000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW transfer AS  SELECT peer_to_peer_transfer.id,
        peer_to_peer_transfer.amount,
        peer_to_peer_transfer."assetId",
        sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
        receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
      FROM peer_to_peer_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = peer_to_peer_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = peer_to_peer_transfer."senderChannelId"
      UNION ALL
      SELECT linked_transfer.id,
        linked_transfer.amount,
        linked_transfer."assetId",
        sender_channel."userPublicIdentifier" AS "senderPublicIdentifier",
        receiver_channel."userPublicIdentifier" AS "receiverPublicIdentifier"
      FROM linked_transfer
        LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"
        LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      DROP VIEW IF EXISTS transfer
    `);
  }
}
