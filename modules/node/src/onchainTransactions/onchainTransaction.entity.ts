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
import { transformBN } from "../utils";

export enum TransactionReason {
  USER_WITHDRAWAL = "USER_WITHDRAWAL",
  COLLATERALIZATION = "COLLATERALIZATION",
  NODE_WITHDRAWAL = "NODE_WITHDRAWAL",
  MULTISIG_DEPLOY = "MULTISIG_DEPLOY",
  DISPUTE = "DISPUTE",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

@Entity()
export class OnchainTransaction {
  // Non-onchain fields
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  reason!: TransactionReason;

  @Column("text")
  status!: TransactionStatus;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  // should this just be a ref to user pub id?
  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.transactions)
  channel!: Channel;

  // Transaction fields assigned by `TransactionResponse` (before mined)
  @Column("text", { transformer: transformBN })
  value!: BigNumber;

  @Column("text", { transformer: transformBN })
  gasPrice!: BigNumber;

  @Column("text", { transformer: transformBN })
  gasLimit!: BigNumber;

  @Column("integer")
  nonce!: number;

  @Column("text")
  to!: string;

  @Column("text")
  from!: string;

  @Column("text", { unique: true })
  hash!: string;

  @Column("text", { nullable: true })
  chainId!: string;

  @Column("integer", { nullable: true })
  blockNumber!: number;

  @Column("text", { nullable: true })
  blockHash!: string;

  @Column("text", { nullable: true })
  raw!: string;

  @Column("text")
  data!: string;

  // Fields from TransactionReceipt (after mined)
  @Column("text", { transformer: transformBN })
  gasUsed!: BigNumber;

  @Column("text", { nullable: true })
  logsBloom!: string;

  @Column("jsonb", { nullable: true })
  errors!: { [k: number]: string };

  @Column("text", { nullable: true })
  appIdentityHash!: string;

  @Column("boolean", { default: false })
  appUninstalled!: boolean;
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
    "onchain_transaction"."status" as "status",
    "onchain_transaction"."gasUsed" as "gasUsed",
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
