import { utils } from "ethers";
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

@Entity()
export class RebalanceProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): utils.BigNumber => new utils.BigNumber(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  collateralizeThreshold!: utils.BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): utils.BigNumber => new utils.BigNumber(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  target!: utils.BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): utils.BigNumber => new utils.BigNumber(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  reclaimThreshold!: utils.BigNumber;

  @Column("text")
  assetId: string;

  @ManyToMany((type: any) => Channel, (channel: Channel) => channel.rebalanceProfiles)
  channels!: Channel[];
}
