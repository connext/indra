import { BigNumber } from "ethers/utils";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress, IsBytes32, IsXpub } from "../util";

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
  @IsEthAddress()
  assetId!: string;

  @Column("text")
  @IsBytes32()
  senderAppInstanceId!: string;

  @Column("text", { nullable: true })
  @IsBytes32()
  receiverAppInstanceId!: string;

  @Column("text")
  @IsBytes32()
  linkedHash!: string;

  @Column("text", { nullable: true })
  @IsBytes32()
  preImage!: string;

  @Column("text", { nullable: true })
  @IsBytes32()
  paymentId!: string;

  @Column("text", { nullable: true })
  @IsXpub()
  recipientPublicIdentifier!: string;

  @Column("text", { nullable: true })
  encryptedPreImage!: string;

  @Column("enum", { default: LinkedTransferStatus.PENDING, enum: LinkedTransferStatus })
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
