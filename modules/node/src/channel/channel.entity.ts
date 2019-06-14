import { BigNumber } from "ethers/utils";
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { App } from "../app/app.entity";
import { User } from "../user/user.entity";
import { IsEthAddress } from "../validator/isEthAddress";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => User, user => user.channels)
  user: User;

  @Column("text")
  @IsXpub()
  xpubPartyA: string;

  @Column("text")
  @IsXpub()
  xpubPartyB: string;

  @Column("text")
  @IsEthAddress()
  multiSigAddress: string;

  @OneToMany(type => App, app => app.channel)
  apps: App[];

  @OneToMany(type => ChannelUpdate, channelUpdate => channelUpdate.channel)
  updates: ChannelUpdate[];
}

@Entity()
export class ChannelUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => Channel, channel => channel.updates)
  channel: Channel;

  @Column("text", {
    transformer: {
      from: (value: string) => new BigNumber(value),
      to: (value: BigNumber) => value.toString(),
    },
  })
  freeBalancePartyA: string;

  @Column("text", {
    transformer: {
      from: (value: string) => new BigNumber(value),
      to: (value: BigNumber) => value.toString(),
    },
  })
  freeBalancePartyB: string;

  @Column("text")
  sigPartyA: string;

  @Column("text")
  sigPartyB: string;
}
