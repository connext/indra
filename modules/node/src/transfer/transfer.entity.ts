import { BigNumber } from "ethers/utils";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

@Entity()
export class Transfer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amount!: BigNumber;

  @Column("citext")
  assetId!: string;

  @Column("citext")
  appInstanceId!: string;

  @OneToMany((type: any) => Channel, (channel: Channel) => channel.transfers)
  channel!: Channel;
}