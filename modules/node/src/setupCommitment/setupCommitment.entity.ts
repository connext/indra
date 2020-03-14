import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { BigNumber } from "ethers/utils";
import { Channel } from "../channel/channel.entity";

@Entity()
export class SetupCommitmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  value!: BigNumber;

  @Column("text")
  to: string;

  @Column("text")
  data!: string;

  // there may not be a channel at the time the setup commitment is
  // created, so add the multisig address as a text field and connect
  // the channel later
  @Column("text")
  multisigAddress!: string;

  @OneToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.setupCommitment,
  )
  @JoinColumn()
  channel!: Channel;
}
