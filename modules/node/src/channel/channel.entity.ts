import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { App } from "../app/app.entity";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  xpubPartyA: string;

  @Column("text")
  xpubPartyB: string;

  @Column("text")
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

  @Column("text")
  freeBalancePartyA: string;

  @Column("text")
  freeBalancePartyB: string;

  @Column("text")
  partyASig: string;

  @Column("text")
  partyBSig: string;
}
