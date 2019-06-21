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
  nodeXpub!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @OneToMany((type: any) => App, (app: App) => app.channel)
  apps!: App[];

  @OneToMany((type: any) => ChannelUpdate, (channelUpdate: ChannelUpdate) => channelUpdate.channel)
  updates!: ChannelUpdate[];
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
        "channelId",
        "id",
        "freeBalancePartyA",
        "freeBalancePartyB",
        "nonce"
      FROM "channel_update"
      ORDER BY "channelId", "nonce" DESC NULLS LAST
    )

    SELECT
      "user"."xpub" as "userXpub",
      "channel"."nodeXpub" as "nodeXpub",
      "channel"."multisigAddress" as "multisigAddress",
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
  nodeXpub: string;

  @ViewColumn()
  userXpub: string;

  @ViewColumn()
  freeBalancePartyA: BigNumber;

  @ViewColumn()
  freeBalancePartyB: BigNumber;

  @ViewColumn()
  nonce: number;
}
