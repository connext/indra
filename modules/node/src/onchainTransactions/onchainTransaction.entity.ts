import { BigNumber } from "ethers/utils";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

export enum TransactionReason {
  USER_WITHDRAWAL = "USER_WITHDRAWAL",
  COLLATERALIZATION = "COLLATERALIZATION",
  NODE_WITHDRAWAL = "NODE_WITHDRAWAL",
}

@Entity()
export class OnchainTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  reason!: TransactionReason;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  value!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  gasPrice!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  gasLimit!: BigNumber;

  @Column("integer")
  nonce!: number;

  @Column("text")
  to!: string;

  @Column("text")
  from!: string;

  @Column("text")
  hash!: string;

  @Column("text")
  data!: string;

  @Column("integer")
  v!: number;

  @Column("text")
  r!: string;

  @Column("text")
  s!: string;

  // should this just be a ref to user pub id?
  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.transactions)
  channel!: Channel;
}
