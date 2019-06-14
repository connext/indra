import { BigNumber } from "ethers/utils";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel } from "../channel/channel.entity";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class App {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => Channel, channel => channel.apps)
  channel: Channel;

  @OneToOne(type => AppRegistry)
  @JoinColumn()
  appRegistry: AppRegistry;

  @Column("number", { nullable: true })
  appId: number;

  @Column("text")
  @IsXpub()
  xpubPartyA: string;

  @Column("text")
  @IsXpub()
  xpubPartyB: string;

  @Column("text", {
    transformer: {
      from: (value: string) => new BigNumber(value),
      to: (value: BigNumber) => value.toString(),
    },
  })
  depositA: string;

  @Column("text", {
    transformer: {
      from: (value: string) => new BigNumber(value),
      to: (value: BigNumber) => value.toString(),
    },
  })
  depositB: string;

  @Column("simple-array")
  @IsXpub({ each: true })
  intermediaries: string[];

  @Column("json")
  initialState: object;

  @Column("number")
  timeout: number;

  @OneToMany(type => AppUpdate, appUpdate => appUpdate.app)
  updates: AppUpdate[];
}

@Entity()
export class AppUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => App, app => app.updates)
  app: App;

  @Column("json")
  action: object;

  @Column("simple-array")
  sigs: string[];
}
