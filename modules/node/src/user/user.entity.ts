import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress } from "../validator/isEthAddress";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  @IsXpub()
  xpub: string;

  @Column("text", { nullable: true })
  @IsEthAddress()
  signingKey: string;

  @OneToMany(type => Channel, channel => channel.user)
  channels: Channel[];
}
