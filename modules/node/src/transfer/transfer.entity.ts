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

  @CreateDateColumn({
    default: Date.now(),
  })
  createdAt!: Date;

  @UpdateDateColumn({
    default: Date.now(),
  })
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

  @Column("enum", { enum: PeerToPeerTransferStatus, default: PeerToPeerTransferStatus.PENDING })
  status!: PeerToPeerTransferStatus;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.senderPeerToPeerTransfers,
  )
  senderChannel!: Channel;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.receiverPeerToPeerTransfers,
  )
  receiverChannel!: Channel;

  @Column("json")
  meta: object;
}

export enum LinkedTransferStatus {
  PENDING = "PENDING",
  CREATED = "CREATED",
  REDEEMED = "REDEEMED",
  FAILED = "FAILED",
  RECLAIMED = "RECLAIMED",
}

@Entity()
export class LinkedTransfer {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn({
    default: Date.now(),
  })
  createdAt!: Date;

  @UpdateDateColumn({
    default: Date.now(),
  })
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

  @Column("text", { nullable: true })
  preImage!: string;

  @Column("text", { nullable: true })
  paymentId!: string;

  @Column("text", { nullable: true })
  recipientPublicIdentifier!: string;

  @Column("text", { nullable: true })
  encryptedPreImage!: string;

  @Column("enum", { enum: LinkedTransferStatus, default: LinkedTransferStatus.PENDING })
  status!: LinkedTransferStatus;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.senderLinkedTransfers,
  )
  senderChannel!: Channel;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.receiverLinkedTransfers,
    {
      nullable: true,
    },
  )
  receiverChannel!: Channel;

  @Column({ type: "json" })
  meta: object;
}

@ViewEntity({
  expression: `
    SELECT
      "peer_to_peer_transfer"."id" as "id",
      "peer_to_peer_transfer"."amount" as "amount",
      "peer_to_peer_transfer"."assetId" as "assetId",
      "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
      "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
      "peer_to_peer_transfer"."createdAt" as "createdAt",
      "peer_to_peer_transfer"."meta" as "meta"
    FROM "peer_to_peer_transfer"
    LEFT JOIN "channel" as "receiver_channel"
      ON "receiver_channel"."id" = "peer_to_peer_transfer"."receiverChannelId"
    LEFT JOIN "channel" as "sender_channel"
      ON "sender_channel"."id" = "peer_to_peer_transfer"."senderChannelId"
    UNION ALL
    SELECT
      "linked_transfer"."id" as "id",
      "linked_transfer"."amount" as "amount",
      "linked_transfer"."assetId" as "assetId",
      "sender_channel"."userPublicIdentifier" as "senderPublicIdentifier",
      "receiver_channel"."userPublicIdentifier" as "receiverPublicIdentifier",
      "linked_transfer"."createdAt" as "createdAt",
      "linked_transfer"."meta" as "meta"
    FROM "linked_transfer"
    LEFT JOIN "channel" as "receiver_channel"
      ON "receiver_channel"."id" = "linked_transfer"."receiverChannelId"
    LEFT JOIN "channel" as "sender_channel"
      ON "sender_channel"."id" = "linked_transfer"."senderChannelId"
  `,
})
export class Transfer {
  @ViewColumn()
  id!: number;

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
  meta: object;
}
