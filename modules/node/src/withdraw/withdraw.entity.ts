import { BigNumber } from "ethers";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress, IsBytes32, IsEthSignature } from "../validate";
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
      from: (value: string): BigNumber => BigNumber.from(value),
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
  appIdentityHash!: string;

  @Column("text")
  @IsBytes32()
  data!: string;

  @Column("text")
  @IsEthSignature()
  withdrawerSignature!: string;

  @Column("text", { nullable: true })
  @IsEthSignature()
  counterpartySignature!: string;

  @Column("text")
  finalized!: boolean;

  @ManyToOne((type: any) => Channel)
  channel!: Channel;

  @OneToOne((type: any) => OnchainTransaction, { nullable: true })
  @JoinColumn()
  onchainTransaction!: OnchainTransaction;
}
