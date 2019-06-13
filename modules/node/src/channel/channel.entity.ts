import { Column, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne } from "typeorm";

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

  @OneToMany(type => ChannelUpdate, channelUpdate => channelUpdate.channel)
  updates: ChannelUpdate[]
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
}