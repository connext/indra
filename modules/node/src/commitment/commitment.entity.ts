import { AppIdentity, NetworkContext } from "@connext/types";
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn } from "typeorm";
import { IsEthAddress, IsKeccak256Hash } from "../util";
import { Channel } from "../channel/channel.entity";
import { AppInstance } from "../appInstance/appInstance.entity";
import { BigNumber, Signature } from "ethers/utils";

export enum CommitmentType {
  CONDITIONAL = "CONDITIONAL",
  WITHDRAWAL = "WITHDRAWAL",
  SET_STATE = "SET_STATE",
  SETUP = "SETUP",
}

@Entity()
export class WithdrawCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

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

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.withdrawalCommitments,
  )
  channel!: Channel;
}

@Entity()
export class SetStateCommitmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

  @Column("json")
  appIdentity!: AppIdentity;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: string;

  @Column("text")
  @IsEthAddress()
  challengeRegistryAddress!: string;

  @Column("json", { nullable: true })
  signatures!: Signature[];

  @Column("integer")
  timeout!: number;

  @Column("integer")
  versionNumber!: number;

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance;
}

@Entity()
export class ConditionalTransactionCommitmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

  @Column("text")
  @IsKeccak256Hash()
  freeBalanceAppIdentityHash!: string;

  @Column("text")
  @IsEthAddress()
  interpreterAddr!: string;

  @Column("text")
  interpreterParams!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("text", { array: true })
  multisigOwners!: string[];

  @Column("json")
  networkContext!: NetworkContext;

  @Column("json", { nullable: true })
  signatures!: Signature[];

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance;
}
