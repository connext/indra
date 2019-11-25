import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransferMetas1574449936874 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
        ALTER TABLE peer_to_peer_transfer
        ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT NOW(),
        ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        ADD COLUMN "meta" json;

        ALTER TABLE linked_transfer
        ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT NOW(),
        ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        ADD COLUMN "meta" json;

        DROP VIEW transfer;

        CREATE OR REPLACE VIEW transfer AS  SELECT peer_to_peer_transfer.id,
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

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
        ALTER TABLE peer_to_peer_transfer
        DROP COLUMN "createdAt",
        DROP COLUMN "updatedAt",
        DROP COLUMN "meta";

        ALTER TABLE linked_transfer
        DROP COLUMN "createdAt",
        DROP COLUMN "updatedAt",
        DROP COLUMN "meta";

        DROP VIEW transfer;

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
}
