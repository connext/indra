import { BigNumber } from "ethers/utils";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

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
  minimumMaintainedCollateralWei!: BigNumber;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amountToCollateralizeWei!: BigNumber;

  @OneToMany((type: any) => Channel, (channel: Channel) => channel.paymentProfile)
  channels!: Channel[];
}
