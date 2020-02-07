import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnonymizedViewTables1581090243171 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD COLUMN "createdAt" timestamp NOT NULL DEFAULT NOW();`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE VIEW anonymized_transfer AS
      SELECT
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
        LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "linked_transfer"."senderChannelId";
    `);

    await queryRunner.query(`
      CREATE OR REPLACE VIEW anonymized_onchain_transaction AS
      SELECT
        "onchain_transaction"."reason" as "reason",
        "onchain_transaction"."value" as "value",
        "onchain_transaction"."gasPrice" as "gasPrice",
        "onchain_transaction"."gasLimit" as "gasLimit",
        "onchain_transaction"."to" as "to",
        "onchain_transaction"."from" as "from",
        "onchain_transaction"."hash" as "hash",
        "onchain_transaction"."data" as "data",
        "onchain_transaction"."nonce" as "nonce",
        "onchain_transaction"."createdAt" as "createdAt",
        encode(digest("channel"."userPublicIdentifier", 'sha256'), 'hex') as "channelIdentifier"
      FROM "onchain_transaction"
        LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`
      ALTER TABLE "onchain_transaction" DROP COLUMN "createdAt";
      DROP VIEW anonymized_transfer;
      DROP VIEW anonymized_onchain_transaction;
    `);
  }
}
