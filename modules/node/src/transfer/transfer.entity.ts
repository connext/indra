import { BigNumber } from "ethers/utils";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

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

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.senderPeerToPeerTransfers)
  senderChannel!: Channel;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.receiverPeerToPeerTransfers)
  receiverChannel!: Channel;
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

  @Column("enum", { enum: LinkedTransferStatus, default: LinkedTransferStatus.PENDING })
  status!: LinkedTransferStatus;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.senderLinkedTransfers)
  senderChannel!: Channel;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.receiverLinkedTransfers, {
    nullable: true,
  })
  receiverChannel!: Channel;
}
