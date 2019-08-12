import { BigNumber } from "ethers/utils";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

export enum TransferTypes {
  LINKED = "LINKED",
  PEER_TO_PEER = "PEER_TO_PEER",
}

export enum TransferStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

@Entity()
export class Transfer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: TransferTypes })
  type!: TransferTypes;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amount!: BigNumber;

  @Column("citext")
  assetId!: string;

  @Column("citext")
  appInstanceId!: string;

  @Column("enum", { enum: TransferStatus, default: TransferStatus.PENDING })
  status!: TransferStatus;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.senderTransfers)
  senderChannel!: Channel;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.receiverTransfers)
  receiverChannel!: Channel;
}