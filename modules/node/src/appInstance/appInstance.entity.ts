import { AppState, OutcomeType } from "@connext/types";
import { BigNumber } from "ethers/utils";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress, IsKeccak256Hash, IsXpub } from "../util";

export enum AppType {
  PROPOSAL = "PROPOSAL",
  INSTANCE = "INSTANCE",
  FREE_BALANCE = "FREE_BALANCE",
  REJECTED = "REJECTED", // removed proposal
  UNINSTALLED = "UNINSTALLED", // removed app
}

@Entity()
export class AppInstance<T extends AppState = any> {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: AppType })
  type!: AppType;

  @Column("text")
  @IsEthAddress()
  appDefinition!: string;

  @Column("text")
  stateEncoding!: string;

  @Column("text", { nullable: true })
  actionEncoding!: string;

  @Column("integer")
  appSeqNo!: number;

  @Column("text", { unique: true })
  @IsKeccak256Hash()
  identityHash!: string;

  @Column("json")
  initialState!: T;

  @Column("json")
  latestState!: T;

  @Column("integer")
  latestTimeout!: number;

  @Column("integer")
  latestVersionNumber!: number;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  initiatorDeposit!: BigNumber;

  @Column("text")
  @IsEthAddress()
  initiatorDepositTokenAddress!: string;

  @Column({ type: "enum", enum: OutcomeType })
  outcomeType!: OutcomeType;

  @Column("text")
  @IsXpub()
  proposedByIdentifier!: string;

  @Column("text")
  @IsXpub()
  proposedToIdentifier!: string;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => new BigNumber(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  responderDeposit!: BigNumber;

  @Column("text")
  @IsEthAddress()
  responderDepositTokenAddress!: string;

  @Column("integer")
  timeout!: number;

  // assigned a value on installation not proposal
  @Column("text", { nullable: true })
  @IsEthAddress()
  userParticipantAddress?: string;

  // assigned a value on installation not proposal
  @Column("text", { nullable: true })
  @IsEthAddress()
  nodeParticipantAddress?: string;

  @Column("json", { nullable: true })
  meta?: object;

  // Interpreter-related Fields
  @Column("json", { nullable: true })
  outcomeInterpreterParameters?: any;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.appInstances,
  )
  channel!: Channel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
