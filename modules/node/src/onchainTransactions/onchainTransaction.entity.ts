import { BigNumber } from "ethers";
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  ViewEntity,
  ViewColumn,
  CreateDateColumn,
} from "typeorm";

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
      from: (value: string): BigNumber => BigNumber.from(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  value!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  gasPrice!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value),
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

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  // should this just be a ref to user pub id?
  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.transactions)
  channel!: Channel;
}

@ViewEntity({
  expression: `
  SELECT
    "onchain_transaction"."createdAt" as "createdAt",
    "onchain_transaction"."reason" as "reason",
    "onchain_transaction"."value" as "value",
    "onchain_transaction"."gasPrice" as "gasPrice",
    "onchain_transaction"."gasLimit" as "gasLimit",
    "onchain_transaction"."to" as "to",
    "onchain_transaction"."from" as "from",
    "onchain_transaction"."hash" as "hash",
    "onchain_transaction"."data" as "data",
    "onchain_transaction"."nonce" as "nonce",
    encode(digest("channel"."userIdentifier", 'sha256'), 'hex') as "publicIdentifier"
  FROM "onchain_transaction"
    LEFT JOIN "channel" ON "channel"."multisigAddress" = "onchain_transaction"."channelMultisigAddress"
  `,
})
export class AnonymizedOnchainTransaction {
  @ViewColumn()
  createdAt!: Date;

  @ViewColumn()
  reason!: string;

  @ViewColumn()
  value!: string;

  @ViewColumn()
  gasPrice!: string;

  @ViewColumn()
  gasLimit!: string;

  @ViewColumn()
  to!: string;

  @ViewColumn()
  from!: string;

  @ViewColumn()
  hash!: string;

  @ViewColumn()
  data!: string;

  @ViewColumn()
  nonce!: number;

  @ViewColumn()
  publicIdentifier!: string;
}
