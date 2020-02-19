import { BigNumber } from "ethers/utils";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ViewColumn,
  ViewEntity,
} from "typeorm";

import { Channel } from "../channel/channel.entity";

export enum PeerToPeerTransferStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity()
export class PeerToPeerTransfer {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amount!: BigNumber;

  @Column("text")
  assetId!: string;

  @Column("text")
  appInstanceId!: string;

  @Column("enum", { default: PeerToPeerTransferStatus.PENDING, enum: PeerToPeerTransferStatus })
  status!: PeerToPeerTransferStatus;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.senderPeerToPeerTransfers)
  senderChannel!: Channel;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.receiverPeerToPeerTransfers)
  receiverChannel!: Channel;

  @Column("json")
  meta: object;
}

export enum LinkedTransferStatus {
  PENDING = "PENDING",
  REDEEMED = "REDEEMED",
  FAILED = "FAILED",
  RECLAIMED = "RECLAIMED",
}

@Entity()
export class LinkedTransfer {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amount!: BigNumber;

  @Column("text")
  assetId!: string;

  @Column("text")
  senderAppInstanceId!: string;

  @Column("text", { nullable: true })
  receiverAppInstanceId!: string;

  @Column("text")
  linkedHash!: string;

  @Column("text")
  signer!: string;

  @Column("text", { nullable: true })
  preImage!: string;

  @Column("text", { nullable: true })
  paymentId!: string;

  @Column("text", { nullable: true })
  recipientPublicIdentifier!: string;

  @Column("text", { nullable: true })
  encryptedPreImage!: string;

  @Column("enum", { default: LinkedTransferStatus.PENDING, enum: LinkedTransferStatus })
  status!: LinkedTransferStatus;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.senderLinkedTransfers)
  senderChannel!: Channel;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.receiverLinkedTransfers, {
    nullable: true,
  })
  receiverChannel!: Channel;

  @Column({ type: "json" })
  meta: object;
}

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
    "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
    "linked_transfer"."createdAt" as "createdAt",
    "linked_transfer"."meta" as "meta",
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

@ViewEntity({
  expression: `
  SELECT
    "peer_to_peer_transfer"."id"::TEXT as "paymentId",
    "peer_to_peer_transfer"."amount" as "amount",
    "peer_to_peer_transfer"."assetId" as "assetId",
    encode(digest("sender_channel"."userPublicIdentifier", 'sha256'), 'hex') as "senderChannelIdentifier",
    encode(digest("receiver_channel"."userPublicIdentifier", 'sha256'), 'hex') as "receiverChannelIdentifier",
    "peer_to_peer_transfer"."createdAt" as "createdAt",
    "peer_to_peer_transfer"."meta" as "meta",
    "peer_to_peer_transfer"."status"::TEXT as "status",
    '${TransferType.P2P}' AS "type"
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
    '${TransferType.LINKED}' AS "type"
  FROM linked_transfer
    LEFT JOIN "channel" "receiver_channel" ON "receiver_channel"."id" = "linked_transfer"."receiverChannelId"
    LEFT JOIN "channel" "sender_channel" ON "sender_channel"."id" = "linked_transfer"."senderChannelId";
  `,
})
export class AnonymizedTransfer {
  @ViewColumn()
  paymentId!: string;

  @ViewColumn()
  createdAt!: Date;

  @ViewColumn()
  amount!: string;

  @ViewColumn()
  assetId!: string;

  @ViewColumn()
  senderChannelIdentifier!: string;

  @ViewColumn()
  receiverChannelIdentifier!: string;

  @ViewColumn()
  type!: string;

  @ViewColumn()
  status!: string;

  @ViewColumn()
  meta!: object;
}
