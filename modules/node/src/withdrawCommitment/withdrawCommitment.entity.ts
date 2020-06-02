import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { utils } from "ethers";

import { Channel } from "../channel/channel.entity";

@Entity()
export class WithdrawCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    transformer: {
      from: (value: string): utils.BigNumber => new utils.BigNumber(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  value!: utils.BigNumber;

  @Column("text")
  to: string;

  @Column("text")
  data!: string;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.withdrawalCommitments)
  channel!: Channel;
}
