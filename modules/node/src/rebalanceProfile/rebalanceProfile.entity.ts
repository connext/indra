import { BigNumber } from "ethers";
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { transformBN } from "../utils";

@Entity()
export class RebalanceProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", { default: "0", transformer: transformBN })
  collateralizeThreshold!: BigNumber;

  @Column("text", { default: "0", transformer: transformBN })
  target!: BigNumber;

  @Column("text", { default: "0", transformer: transformBN })
  reclaimThreshold!: BigNumber;

  @Column("text")
  assetId!: string;

  @ManyToMany((type: any) => Channel, (channel: Channel) => channel.rebalanceProfiles)
  channels!: Channel[];
}
