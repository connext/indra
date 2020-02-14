import { BigNumber } from "ethers/utils";
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { MaxUint256, Zero } from "ethers/constants";

@Entity()
export class PaymentProfile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    default: Zero,
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  lowerBoundCollateralize!: BigNumber;

  @Column("text", {
    default: Zero,
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  upperBoundCollateralize!: BigNumber;

  @Column("text", {
    default: MaxUint256,
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  lowerBoundReclaim!: BigNumber;

  @Column("text", {
    default: MaxUint256,
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  upperBoundReclaim!: BigNumber;

  @Column("text")
  assetId: string;

  @ManyToMany(
    (type: any) => Channel,
    (channel: Channel) => channel.paymentProfiles,
  )
  channels!: Channel[];
}
