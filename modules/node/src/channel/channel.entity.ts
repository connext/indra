import { CriticalStateChannelAddresses } from "@connext/types";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
  PrimaryColumn,
} from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { IsEthAddress, IsValidPublicIdentifier } from "../validate";
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { Challenge } from "../challenge/challenge.entity";

@Entity()
export class Channel {
  @PrimaryColumn("text")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("integer", { default: 0 })
  schemaVersion!: number;

  @Column("jsonb", { nullable: true })
  addresses!: CriticalStateChannelAddresses;

  @Column("text")
  @IsValidPublicIdentifier()
  userIdentifier!: string;

  // might not need this
  @Column("text")
  @IsValidPublicIdentifier()
  nodeIdentifier!: string;

  @Column("boolean", { default: false })
  available!: boolean;

  @OneToMany((type: any) => AppInstance, (appInstance: AppInstance) => appInstance.channel, {
    cascade: true,
  })
  appInstances!: AppInstance[];

  @Column("integer", { nullable: true })
  monotonicNumProposedApps!: number;

  @Column("integer")
  chainId!: number;

  @OneToMany(
    (type: any) => WithdrawCommitment,
    (withdrawalCommitment: WithdrawCommitment) => withdrawalCommitment.channel,
  )
  withdrawalCommitments!: WithdrawCommitment[];

  @OneToOne((type: any) => SetupCommitment, (commitment: SetupCommitment) => commitment.channel, {
    cascade: true,
  })
  setupCommitment!: SetupCommitment;

  @ManyToMany((type: any) => RebalanceProfile, (profile: RebalanceProfile) => profile.channels)
  @JoinTable()
  rebalanceProfiles!: RebalanceProfile[];

  @OneToMany((type: any) => OnchainTransaction, (tx: OnchainTransaction) => tx.channel)
  transactions!: OnchainTransaction[];

  @OneToMany((type: any) => Challenge, (challenge: Challenge) => challenge.channel)
  challenges!: Challenge[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
