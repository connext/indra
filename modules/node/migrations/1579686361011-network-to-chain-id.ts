import {MigrationInterface, QueryRunner} from "typeorm";

export class NetworkToChainId1579686361011 implements MigrationInterface {
    name = 'NetworkToChainId1579686361011'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP VIEW "transfer"`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP CONSTRAINT "onchain_transaction_channelId_fkey"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" RENAME COLUMN "network" TO "chainId"`, undefined);
        await queryRunner.query(`ALTER TYPE "public"."app_registry_network_enum" RENAME TO "app_registry_chainid_enum"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "chainId"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" ADD "chainId" integer NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "reason"`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "reason" text NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "peer_to_peer_transfer" ALTER COLUMN "meta" SET NOT NULL`, undefined);
        await queryRunner.query(`ALTER TYPE "public"."linked_transfer_status_enum" RENAME TO "linked_transfer_status_enum_old"`, undefined);
        await queryRunner.query(`CREATE TYPE "linked_transfer_status_enum" AS ENUM('PENDING', 'REDEEMED', 'FAILED', 'RECLAIMED')`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" DROP DEFAULT`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" TYPE "linked_transfer_status_enum" USING "status"::"text"::"linked_transfer_status_enum"`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" SET DEFAULT 'PENDING'`, undefined);
        await queryRunner.query(`DROP TYPE "linked_transfer_status_enum_old"`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "meta" SET NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD CONSTRAINT "FK_9c7a599292fa0a06669750e9425" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`CREATE VIEW "transfer" AS 
    SELECT
      "peer_to_peer_transfer"."id" as "payment_id",
      "peer_to_peer_transfer"."amount" as "amount",
      "peer_to_peer_transfer"."assetId" as "assetId",
      "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
      "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
      "peer_to_peer_transfer"."createdAt" as "createdAt",
      "peer_to_peer_transfer"."meta" as "meta",
      "peer_to_peer_transfer"."status"::TEXT as "status",
      'P2P' as "type"
    FROM "peer_to_peer_transfer"
    LEFT JOIN "channel" as "receiver_channel"
      ON "receiver_channel"."id" = "peer_to_peer_transfer"."receiverChannelId"
    LEFT JOIN "channel" as "sender_channel"
      ON "sender_channel"."id" = "peer_to_peer_transfer"."senderChannelId"
    UNION ALL
    SELECT
      "linked_transfer"."id" as "payment_id",
      "linked_transfer"."amount" as "amount",
      "linked_transfer"."assetId" as "assetId",
      "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
      "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
      "linked_transfer"."createdAt" as "createdAt",
      "linked_transfer"."meta" as "meta",
      "linked_transfer"."status"::TEXT as "status",
      'LINKED' as "type"
    FROM "linked_transfer"
    LEFT JOIN "channel" as "receiver_channel"
      ON "receiver_channel"."id" = "linked_transfer"."receiverChannelId"
    LEFT JOIN "channel" as "sender_channel"
      ON "sender_channel"."id" = "linked_transfer"."senderChannelId"
  `, undefined);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","public","transfer","SELECT\n      \"peer_to_peer_transfer\".\"id\" as \"payment_id\",\n      \"peer_to_peer_transfer\".\"amount\" as \"amount\",\n      \"peer_to_peer_transfer\".\"assetId\" as \"assetId\",\n      \"sender_channel\".\"userPublicIdentifier\" as \"senderPublicIdentifier\",\n      \"receiver_channel\".\"userPublicIdentifier\" as \"receiverPublicIdentifier\",\n      \"peer_to_peer_transfer\".\"createdAt\" as \"createdAt\",\n      \"peer_to_peer_transfer\".\"meta\" as \"meta\",\n      \"peer_to_peer_transfer\".\"status\"::TEXT as \"status\",\n      'P2P' as \"type\"\n    FROM \"peer_to_peer_transfer\"\n    LEFT JOIN \"channel\" as \"receiver_channel\"\n      ON \"receiver_channel\".\"id\" = \"peer_to_peer_transfer\".\"receiverChannelId\"\n    LEFT JOIN \"channel\" as \"sender_channel\"\n      ON \"sender_channel\".\"id\" = \"peer_to_peer_transfer\".\"senderChannelId\"\n    UNION ALL\n    SELECT\n      \"linked_transfer\".\"id\" as \"payment_id\",\n      \"linked_transfer\".\"amount\" as \"amount\",\n      \"linked_transfer\".\"assetId\" as \"assetId\",\n      \"sender_channel\".\"userPublicIdentifier\" as \"senderPublicIdentifier\",\n      \"receiver_channel\".\"userPublicIdentifier\" as \"receiverPublicIdentifier\",\n      \"linked_transfer\".\"createdAt\" as \"createdAt\",\n      \"linked_transfer\".\"meta\" as \"meta\",\n      \"linked_transfer\".\"status\"::TEXT as \"status\",\n      'LINKED' as \"type\"\n    FROM \"linked_transfer\"\n    LEFT JOIN \"channel\" as \"receiver_channel\"\n      ON \"receiver_channel\".\"id\" = \"linked_transfer\".\"receiverChannelId\"\n    LEFT JOIN \"channel\" as \"sender_channel\"\n      ON \"sender_channel\".\"id\" = \"linked_transfer\".\"senderChannelId\""]);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["public","transfer"]);
        await queryRunner.query(`DROP VIEW "transfer"`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP CONSTRAINT "FK_9c7a599292fa0a06669750e9425"`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "meta" DROP NOT NULL`, undefined);
        await queryRunner.query(`CREATE TYPE "linked_transfer_status_enum_old" AS ENUM('PENDING', 'CREATED', 'REDEEMED', 'FAILED', 'RECLAIMED')`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" DROP DEFAULT`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" TYPE "linked_transfer_status_enum_old" USING "status"::"text"::"linked_transfer_status_enum_old"`, undefined);
        await queryRunner.query(`ALTER TABLE "linked_transfer" ALTER COLUMN "status" SET DEFAULT 'PENDING'`, undefined);
        await queryRunner.query(`DROP TYPE "linked_transfer_status_enum"`, undefined);
        await queryRunner.query(`ALTER TYPE "linked_transfer_status_enum_old" RENAME TO  "linked_transfer_status_enum"`, undefined);
        await queryRunner.query(`ALTER TABLE "peer_to_peer_transfer" ALTER COLUMN "meta" DROP NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "reason"`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD "reason" "onchain_transaction_reason_enum" NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" DROP COLUMN "chainId"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" ADD "chainId" "app_registry_chainid_enum" NOT NULL`, undefined);
        await queryRunner.query(`ALTER TYPE "app_registry_chainid_enum" RENAME TO "app_registry_network_enum"`, undefined);
        await queryRunner.query(`ALTER TABLE "app_registry" RENAME COLUMN "chainId" TO "network"`, undefined);
        await queryRunner.query(`ALTER TABLE "onchain_transaction" ADD CONSTRAINT "onchain_transaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
    }

}
