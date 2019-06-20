import { BigNumber } from "ethers/utils";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  ViewEntity,
  ViewColumn,
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

  @Column("text")
  @IsXpub()
  counterpartyXpub!: string;

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
    SELECT
      "user"."xpub" as "nodeXpub",
      "channel"."counterpartyXpub" as "counterpartyXpub",
      "channel"."multisigAddress" as "multisigAddress",
      "channel_update"."freeBalancePartyA" as "freeBalancePartyA",
      "channel_update"."freeBalancePartyB" as "freeBalancePartyB",
      "channel_update"."nonce" as "nonce"
    FROM "user" "user"
    LEFT JOIN "channel" "channel" ON "channel"."userId" = "user"."id"
    LEFT JOIN "channel_update" ON "channel_update"."channelId" = (
      SELECT "id" FROM "channel_update"
      ORDER BY "nonce" DESC
      LIMIT 1
    )
  `,
})
export class NodeChannel {
  @ViewColumn()
  nodeXpub: string;

  @ViewColumn()
  counterpartyXpub: string;

  @ViewColumn()
  freeBalancePartyA: BigNumber;

  @ViewColumn()
  freeBalancePartyB: BigNumber;

  @ViewColumn()
  nonce: number;
}
