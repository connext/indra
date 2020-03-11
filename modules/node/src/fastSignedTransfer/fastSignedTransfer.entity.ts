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
import { IsEthAddress, IsBytes32, IsValidHex } from "../util";

export enum FastSignedTransferStatus {
  PENDING = "PENDING",
  REDEEMED = "REDEEMED",
  FAILED = "FAILED",
  RECLAIMED = "RECLAIMED",
}

@Entity()
export class FastSignedTransfer {
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
  paymentId!: string;

  @Column("text", { nullable: true })
  @IsEthAddress()
  signer!: string;

  @Column("text", { nullable: true })
  @IsValidHex()
  data!: string;

  @Column("text", { nullable: true })
  @IsValidHex()
  signature!: string;

  @Column("enum", { default: FastSignedTransferStatus.PENDING, enum: FastSignedTransferStatus })
  status!: FastSignedTransferStatus;

  @Column("text")
  @IsBytes32()
  senderAppInstanceId!: string;

  @Column("text", { nullable: true })
  @IsBytes32()
  receiverAppInstanceId!: string;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.senderFastSignedTransfers,
  )
  senderChannel!: Channel;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.receiverFastSignedTransfers,
    {
      nullable: true,
    },
  )
  receiverChannel!: Channel;

  @Column({ type: "json" })
  meta: object;
}
