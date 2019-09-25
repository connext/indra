import { BigNumber } from "ethers/utils";
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";

@Entity()
export class PaymentProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  minimumMaintainedCollateral!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amountToCollateralize!: BigNumber;

  @Column("text")
  assetId: string;

  @ManyToMany((type: any) => Channel, (channel: Channel) => channel.paymentProfiles)
  channels!: Channel[];
}
