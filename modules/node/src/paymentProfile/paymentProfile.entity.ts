import { BigNumber } from "ethers/utils";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class PaymentProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  minimumMaintainedCollateralWei: string;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  minimumMaintainedCollateralToken: string;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amountToCollateralizeWei: string;

  @Column("text", {
    default: "0",
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  amountToCollateralizeToken: string;
}
