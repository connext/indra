import { MigrationInterface, QueryRunner, Table } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export class typeormSync1584364675207 implements MigrationInterface {
  name = "typeormSync1584364675207";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const options = queryRunner.connection.driver.options as PostgresConnectionOptions;
    const typeormMetadataTable = queryRunner.connection.driver.buildTableName(
      "typeorm_metadata",
      options.schema,
      options.database,
    );

    await queryRunner.createTable(
      new Table({
        name: typeormMetadataTable,
        columns: [
          {
            name: "type",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataType,
            }),
            isNullable: false,
          },
          {
            name: "database",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataDatabase,
            }),
            isNullable: true,
          },
          {
            name: "schema",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataSchema,
            }),
            isNullable: true,
          },
          {
            name: "table",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataTable,
            }),
            isNullable: true,
          },
          {
            name: "name",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataName,
            }),
            isNullable: true,
          },
          {
            name: "value",
            type: queryRunner.connection.driver.normalizeType({
              type: queryRunner.connection.driver.mappedDataTypes.metadataValue,
            }),
            isNullable: true,
          },
        ],
      }),
      true,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP CONSTRAINT "onchain_transaction_channelId_fkey"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_e13899dee318fd939719e9b338a"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_a5bdc94414f8e850e0c7c108c46"`,
      undefined,
    );
    await queryRunner.query(`DROP INDEX "IDX_e13899dee318fd939719e9b338"`, undefined);
    await queryRunner.query(`DROP INDEX "IDX_a5bdc94414f8e850e0c7c108c4"`, undefined);
    await queryRunner.query(`DROP VIEW "transfer"`, undefined);
    await queryRunner.query(`DROP VIEW "anonymized_transfer"`, undefined);
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ALTER COLUMN "reason" TYPE text`,
      undefined,
    );
    await queryRunner.query(
      `CREATE SEQUENCE "rebalance_profile_id_seq" OWNED BY "rebalance_profile"."id"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" SET DEFAULT nextval('rebalance_profile_id_seq')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."linked_transfer_status_enum" RENAME TO "linked_transfer_status_enum_old"`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "linked_transfer_status_enum" AS ENUM('PENDING', 'REDEEMED', 'FAILED', 'RECLAIMED')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" TYPE "linked_transfer_status_enum" USING "status"::"text"::"linked_transfer_status_enum"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "linked_transfer_status_enum_old"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "meta" SET NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a6e241f5665c326b3e201d8425" ON "channel_rebalance_profiles_rebalance_profile" ("channelId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_26fcccb4dfc210a7aa00e9fecd" ON "channel_rebalance_profiles_rebalance_profile" ("rebalanceProfileId") `,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD CONSTRAINT "FK_9c7a599292fa0a06669750e9425" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_a6e241f5665c326b3e201d84253" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0" FOREIGN KEY ("rebalanceProfileId") REFERENCES "rebalance_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `CREATE VIEW "transfer" AS 
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
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "transfer",
        'SELECT\n    "fast_signed_transfer"."paymentId" as "paymentId",\n    "fast_signed_transfer"."amount" as "amount",\n    "fast_signed_transfer"."assetId" as "assetId",\n    "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",\n    "fast_signed_transfer"."createdAt" as "createdAt",\n    "fast_signed_transfer"."meta" as "meta",\n    "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",\n    "fast_signed_transfer"."status"::TEXT as "status",\n    \'FAST_SIGNED\' AS "type"\n  FROM fast_signed_transfer\n    LEFT JOIN channel receiver_channel ON receiver_channel.id = fast_signed_transfer."receiverChannelId"\n    LEFT JOIN channel sender_channel ON sender_channel.id = fast_signed_transfer."senderChannelId"\n  UNION ALL\n  SELECT\n    "linked_transfer"."paymentId" as "paymentId",\n    "linked_transfer"."amount" as "amount",\n    "linked_transfer"."assetId" as "assetId",\n    "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",\n    "linked_transfer"."createdAt" as "createdAt",\n    "linked_transfer"."meta" as "meta",\n    "linked_transfer"."recipientPublicIdentifier" as "receiverPublicIdentifier",\n    "linked_transfer"."status"::TEXT as "status",\n    \'LINKED\' AS "type"\n  FROM linked_transfer\n    LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"\n    LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";',
      ],
    );
    await queryRunner.query(
      `CREATE VIEW "anonymized_transfer" AS 
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
  `,
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
      `CREATE VIEW "anonymized_onchain_transaction" AS 
  SELECT
    "onchain_transaction"."createdAt" as "createdAt",
    "onchain_transaction"."reason" as "reason",
    "onchain_transaction"."value" as "value",
    "onchain_transaction"."gasPrice" as "gasPrice",
    "onchain_transaction"."gasLimit" as "gasLimit",
    "onchain_transaction"."to" as "to",
    "onchain_transaction"."from" as "from",
    "onchain_transaction"."hash" as "hash",
    "onchain_transaction"."data" as "data",
    "onchain_transaction"."nonce" as "nonce",
    encode(digest("channel"."userPublicIdentifier", 'sha256'), 'hex') as "channelIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"
  `,
      undefined,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`,
      [
        "VIEW",
        "public",
        "anonymized_onchain_transaction",
        'SELECT\n    "onchain_transaction"."createdAt" as "createdAt",\n    "onchain_transaction"."reason" as "reason",\n    "onchain_transaction"."value" as "value",\n    "onchain_transaction"."gasPrice" as "gasPrice",\n    "onchain_transaction"."gasLimit" as "gasLimit",\n    "onchain_transaction"."to" as "to",\n    "onchain_transaction"."from" as "from",\n    "onchain_transaction"."hash" as "hash",\n    "onchain_transaction"."data" as "data",\n    "onchain_transaction"."nonce" as "nonce",\n    encode(digest("channel"."userPublicIdentifier", \'sha256\'), \'hex\') as "channelIdentifier"\n  FROM "onchain_transaction"\n    LEFT JOIN "channel" ON "channel"."id" = "onchain_transaction"."channelId"',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_onchain_transaction"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_onchain_transaction"`, undefined);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "anonymized_transfer"],
    );
    await queryRunner.query(`DROP VIEW "anonymized_transfer"`, undefined);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`,
      ["public", "transfer"],
    );
    await queryRunner.query(`DROP VIEW "transfer"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_26fcccb4dfc210a7aa00e9fecd0"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" DROP CONSTRAINT "FK_a6e241f5665c326b3e201d84253"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" DROP CONSTRAINT "FK_9c7a599292fa0a06669750e9425"`,
      undefined,
    );
    await queryRunner.query(`DROP INDEX "IDX_26fcccb4dfc210a7aa00e9fecd"`, undefined);
    await queryRunner.query(`DROP INDEX "IDX_a6e241f5665c326b3e201d8425"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "meta" DROP NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `CREATE TYPE "linked_transfer_status_enum_old" AS ENUM('PENDING', 'CREATED', 'REDEEMED', 'FAILED', 'RECLAIMED')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" TYPE "linked_transfer_status_enum_old" USING "status"::"text"::"linked_transfer_status_enum_old"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "linked_transfer" ALTER COLUMN "status" SET DEFAULT 'PENDING'`,
      undefined,
    );
    await queryRunner.query(`DROP TYPE "linked_transfer_status_enum"`, undefined);
    await queryRunner.query(
      `ALTER TYPE "linked_transfer_status_enum_old" RENAME TO  "linked_transfer_status_enum"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" SET DEFAULT nextval('payment_profile_id_seq'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "rebalance_profile" ALTER COLUMN "id" DROP DEFAULT`,
      undefined,
    );
    await queryRunner.query(`DROP SEQUENCE "rebalance_profile_id_seq"`, undefined);
    await queryRunner.query(`ALTER TABLE "onchain_transaction" DROP COLUMN "reason"`, undefined);
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD "reason" "onchain_transaction_reason_enum" NOT NULL`,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a5bdc94414f8e850e0c7c108c4" ON "channel_rebalance_profiles_rebalance_profile" ("rebalanceProfileId") `,
      undefined,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e13899dee318fd939719e9b338" ON "channel_rebalance_profiles_rebalance_profile" ("channelId") `,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_a5bdc94414f8e850e0c7c108c46" FOREIGN KEY ("rebalanceProfileId") REFERENCES "rebalance_profile"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_rebalance_profiles_rebalance_profile" ADD CONSTRAINT "FK_e13899dee318fd939719e9b338a" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "onchain_transaction" ADD CONSTRAINT "onchain_transaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      undefined,
    );
  }
}
