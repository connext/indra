import { ViewColumn, ViewEntity } from "typeorm";

export enum TransferType {
  P2P = "P2P",
  LINKED = "LINKED",
}

@ViewEntity({
  expression: `
  SELECT
    "peer_to_peer_transfer"."id"::TEXT as "paymentId",
    "peer_to_peer_transfer"."amount" as "amount",
    "peer_to_peer_transfer"."assetId" as "assetId",
    "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
    "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
    "peer_to_peer_transfer"."createdAt" as "createdAt",
    "peer_to_peer_transfer"."meta" as "meta",
    "peer_to_peer_transfer"."status"::TEXT as "status",
    '${TransferType.P2P}' AS "type"
  FROM peer_to_peer_transfer
    LEFT JOIN channel receiver_channel ON receiver_channel.id = peer_to_peer_transfer."receiverChannelId"
    LEFT JOIN channel sender_channel ON sender_channel.id = peer_to_peer_transfer."senderChannelId"
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
    '${TransferType.LINKED}' AS "type"
  FROM linked_transfer
    LEFT JOIN channel receiver_channel ON receiver_channel.id = linked_transfer."receiverChannelId"
    LEFT JOIN channel sender_channel ON sender_channel.id = linked_transfer."senderChannelId";
  `,
})
export class Transfer {
  @ViewColumn()
  paymentId!: string;

  @ViewColumn()
  createdAt!: Date;

  @ViewColumn()
  amount!: string;

  @ViewColumn()
  assetId!: string;

  @ViewColumn()
  senderPublicIdentifier!: string;

  @ViewColumn()
  receiverPublicIdentifier!: string;

  @ViewColumn()
  type!: string;

  @ViewColumn()
  status!: string;

  @ViewColumn()
  meta!: object;
}
