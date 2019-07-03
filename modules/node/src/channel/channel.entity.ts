import { BigNumber } from "ethers/utils";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  ViewColumn,
  ViewEntity,
} from "typeorm";

import { App } from "../app/app.entity";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { User } from "../user/user.entity";
import { IsEthAddress } from "../validator/isEthAddress";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne((type: any) => User, (user: User) => user.channels)
  @JoinColumn()
  user!: User;

  // might not need this
  @Column("text")
  @IsXpub()
  nodePublicIdentifier!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @OneToMany((type: any) => App, (app: App) => app.channel)
  apps!: App[];

  @OneToMany((type: any) => ChannelUpdate, (channelUpdate: ChannelUpdate) => channelUpdate.channel)
  updates!: ChannelUpdate[];

  @Column("boolean", { default: false })
  available!: boolean;

  @ManyToOne((type: any) => PaymentProfile, (profile: PaymentProfile) => profile.channels)
  @JoinColumn()
  paymentProfile!: PaymentProfile;
}

@Entity()
export class ChannelUpdate {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.updates)
  @JoinColumn()
  channel!: Channel;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalanceWeiNode!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalanceWeiUser!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalanceTokenNode!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalanceTokenUser!: BigNumber;

  @Column("integer")
  nonce!: number;

  @Column("text", { nullable: true })
  sigPartyA!: string;

  @Column("text", { nullable: true })
  sigPartyB!: string;
}

@ViewEntity({
  expression: `
    WITH latest_updates AS (
      SELECT DISTINCT ON ("channelId")
        "id",
        "channelId",
        "freeBalanceWeiUser",
        "freeBalanceWeiNode",
        "freeBalanceTokenUser",
        "freeBalanceTokenNode",
        "nonce"
      FROM "channel_update"
      ORDER BY "channelId", "nonce" DESC NULLS LAST
    )

    SELECT
      "channel"."id" as "channelId",
      "user"."publicIdentifier" as "userPublicIdentifier",
      "channel"."nodePublicIdentifier" as "nodePublicIdentifier",
      "channel"."multisigAddress" as "multisigAddress",
      "channel"."available" as "available",
      "latest_updates"."id" as "updateId",
      "latest_updates"."freeBalanceWeiUser",
      "latest_updates"."freeBalanceWeiNode",
      "latest_updates"."freeBalanceTokenUser",
      "latest_updates"."freeBalanceTokenNode",
      "latest_updates"."nonce"
    FROM "channel" "channel"
    LEFT JOIN "latest_updates" "latest_updates"
      ON "channel"."id" = "latest_updates"."channelId"
    LEFT JOIN "user" "user"
      ON "user"."id" = "channel"."userId"
  `,
})
export class NodeChannel {
  @ViewColumn()
  channelId!: number;

  @ViewColumn()
  nodePublicIdentifier!: string;

  @ViewColumn()
  userPublicIdentifier!: string;

  @ViewColumn()
  multisigAddress!: string;

  @ViewColumn()
  available!: boolean;

  @ViewColumn()
  freeBalanceWeiNode!: string;

  @ViewColumn()
  freeBalanceWeiUser!: string; // TODO: how to make this BigNumber

  @ViewColumn()
  freeBalanceTokenNode!: string;

  @ViewColumn()
  freeBalanceTokenUser!: string; // TODO: how to make this BigNumber

  @ViewColumn()
  nonce!: number;
}
