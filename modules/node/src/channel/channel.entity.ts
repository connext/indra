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
  paymentProfile: PaymentProfile;
}

@Entity()
export class ChannelUpdate {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.updates)
  @JoinColumn()
  channel!: Channel;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalancePartyA!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  freeBalancePartyB!: BigNumber;

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
        "freeBalancePartyA",
        "freeBalancePartyB",
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
      "latest_updates"."freeBalancePartyA",
      "latest_updates"."freeBalancePartyB",
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
  channelId: number;

  @ViewColumn()
  nodePublicIdentifier: string;

  @ViewColumn()
  userPublicIdentifier: string;

  @ViewColumn()
  multisigAddress: string;

  @ViewColumn()
  available: boolean;

  @ViewColumn()
  freeBalancePartyA: string; // TODO: how to make this BigNumber

  @ViewColumn()
  freeBalancePartyB: string;

  @ViewColumn()
  nonce: number;
}
