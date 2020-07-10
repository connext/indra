import { BigNumber, constants } from "ethers";
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

@Entity()
export class RebalanceProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value || "0"),
      to: (value: BigNumber): string => (value || constants.Zero).toString(),
    },
  })
  collateralizeThreshold!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value || "0"),
      to: (value: BigNumber): string => (value || constants.Zero).toString(),
    },
  })
  target!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value || "0"),
      to: (value: BigNumber): string => (value || constants.Zero).toString(),
    },
  })
  reclaimThreshold!: BigNumber;

  @Column("text")
  assetId: string;

  @ManyToMany((type: any) => Channel, (channel: Channel) => channel.rebalanceProfiles)
  channels!: Channel[];
}
