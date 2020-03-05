import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
} from "typeorm";
import { BigNumber } from "ethers/utils";

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
