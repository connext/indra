import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { BigNumber } from "ethers";

import { Channel } from "../channel/channel.entity";
import { transformBN } from "../utils";

@Entity()
export class WithdrawCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", { transformer: transformBN })
  value!: BigNumber;

  @Column("text")
  to!: string;

  @Column("text")
  data!: string;

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.withdrawalCommitments)
  channel!: Channel;
}
