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
  xpubPartyA: string;

  @Column("text")
  xpubPartyB: string;

  @Column("text")
  depositA: string;

  @Column("text")
  depositB: string;

  @Column("simple-array")
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
