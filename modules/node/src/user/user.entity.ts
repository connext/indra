import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  @IsXpub()
  publicIdentifier!: string;

  @OneToMany((type: any) => Channel, (channel: Channel) => channel.user)
  channels!: Channel[];
}
