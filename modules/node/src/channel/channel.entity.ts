import { CriticalStateChannelAddresses, Collateralizations, JSONSerializer } from "@connext/types";
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
import { constants } from "ethers";

import {
  AppInstance,
  AppInstanceJSON,
  AppInstanceSerializer,
} from "../appInstance/appInstance.entity";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { IsEthAddress, IsValidPublicIdentifier } from "../validate";
import { WithdrawCommitment } from "../withdrawCommitment/withdrawCommitment.entity";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";
import { bigNumberifyJson, deBigNumberifyJson } from "@connext/utils";

const { AddressZero } = constants;

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

  @Column("json", { default: { [AddressZero]: false } })
  activeCollateralizations!: Collateralizations;

  @OneToMany((type: any) => AppInstance, (appInstance: AppInstance) => appInstance.channel, {
    cascade: true,
  })
  appInstances!: AppInstance[];

  @Column("integer", { nullable: true })
  monotonicNumProposedApps!: number;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface ChannelJSON {
  multisigAddress: string;
  schemaVersion: number;
  addresses: CriticalStateChannelAddresses;
  userIdentifier: string;
  nodeIdentifier: string;
  available: boolean;
  activeCollateralizations: Collateralizations;
  appInstances: AppInstanceJSON[];
  monotonicNumProposedApps: number;
  // withdrawalCommitments: WithdrawCommitmentJSON[]
  // setupCommitment: SetupCommitmentJSON[]
  // rebalanceProfiles: RebalanceProfileJSON[]
  // transactions: OnchainTransactionJSON[]
  createdAt: number;
  updatedAt: number;
}

export const ChannelSerializer: JSONSerializer<Channel, ChannelJSON> = class {
  static fromJSON(input: ChannelJSON): Channel {
    const chan = new Channel();
    Object.assign(
      chan,
      deBigNumberifyJson({
        multisigAddress: input.multisigAddress,
        schemaVersion: input.schemaVersion,
        addresses: input.addresses,
        userIdentifier: input.userIdentifier,
        nodeIdentifier: input.nodeIdentifier,
        available: input.available,
        activeCollateralizations: input.activeCollateralizations,
        monotonicNumProposedApps: input.monotonicNumProposedApps,
      }),
    );
    chan.appInstances = input.appInstances.map(AppInstanceSerializer.fromJSON);
    chan.createdAt = new Date(input.createdAt);
    chan.updatedAt = new Date(input.updatedAt);
    return chan;
  }

  static toJSON(input: Channel): ChannelJSON {
    const res = bigNumberifyJson({
      multisigAddress: input.multisigAddress,
      schemaVersion: input.schemaVersion,
      addresses: input.addresses,
      userIdentifier: input.userIdentifier,
      nodeIdentifier: input.nodeIdentifier,
      available: input.available,
      activeCollateralizations: input.activeCollateralizations,
      monotonicNumProposedApps: input.monotonicNumProposedApps,
      createdAt: input.createdAt ? input.createdAt.getTime() : Date.now(),
      updatedAt: input.updatedAt ? input.updatedAt.getTime() : Date.now(),
    });
    res.appInstances = input.appInstances.map(AppInstanceSerializer.toJSON);
    return res;
  }
};
