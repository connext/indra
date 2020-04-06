import { CriticalStateChannelAddresses, Collateralizations } from "@connext/types";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { IsEthAddress, IsXpub } from "../util";
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { AddressZero } from "ethers/constants";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("integer", { default: 0 })
  schemaVersion!: number;

  @Column("jsonb", { nullable: true })
  addresses!: CriticalStateChannelAddresses;

  @Column("text")
  @IsXpub()
  userPublicIdentifier!: string;

  // might not need this
  @Column("text")
  @IsXpub()
  nodePublicIdentifier!: string;

  @Column("text", { unique: true })
  @IsEthAddress()
  multisigAddress!: string;

  @Column("boolean", { default: false })
  available!: boolean;

  @Column("json", { default: { [AddressZero]: false } })
  activeCollateralizations!: Collateralizations;

  @OneToMany(
    (type: any) => AppInstance,
    (appInstance: AppInstance) => appInstance.channel,
    { cascade: true },
  )
  appInstances!: AppInstance[];

  @Column("integer", { nullable: true })
  monotonicNumProposedApps!: number;

  @OneToMany(
    (type: any) => WithdrawCommitment,
    (withdrawalCommitment: WithdrawCommitment) => withdrawalCommitment.channel,
  )
  withdrawalCommitments!: WithdrawCommitment[];

  @OneToOne(
    (type: any) => WithdrawCommitment,
    (commitment: SetupCommitment) => commitment.channel,
    { cascade: true },
  )
  setupCommitment!: SetupCommitment;

  @ManyToMany(
    (type: any) => RebalanceProfile,
    (profile: RebalanceProfile) => profile.channels,
  )
  @JoinTable()
  rebalanceProfiles!: RebalanceProfile[];

  @OneToMany(
    (type: any) => OnchainTransaction,
    (tx: OnchainTransaction) => tx.channel,
  )
  transactions!: OnchainTransaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
