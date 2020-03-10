import { BigNumber } from "ethers/utils";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
} from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress, IsBytes32 } from "../util";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";

@Entity()
export class Withdraw {
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
  @IsEthAddress()
  recipient!: string;

  @Column("text")
  @IsBytes32()
  appInstanceId!: string;

  @Column("text")
  @IsBytes32()
  data!: string;

  @Column("text")
  @IsBytes32()
  withdrawerSignature!: string;

  @Column("text", { nullable: true })
  @IsBytes32()
  counterpartySignature!: string;

  @Column("text")
  finalized!: boolean;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.multisigAddress,
  )
  channel!: Channel;

  @OneToOne(
    (type: any) => OnchainTransaction,
    { nullable: true }
  )
  onchainTransaction!: OnchainTransaction;
}
