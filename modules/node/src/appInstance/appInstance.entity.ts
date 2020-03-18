import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { IsEthAddress, IsKeccak256Hash, IsXpub } from "../util";
import { OutcomeType, SolidityValueType } from "@connext/types";

import { Channel } from "../channel/channel.entity";
import { BigNumber } from "ethers/utils";

export enum AppType {
  PROPOSAL = "PROPOSAL",
  INSTANCE = "INSTANCE",
  FREE_BALANCE = "FREE_BALANCE",
  REJECTED = "REJECTED", // removed proposal
  UNINSTALLED = "UNINSTALLED", // removed app
}

@Entity("app_instance")
export class AppInstance {
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

  @Column("text")
  @IsKeccak256Hash()
  identityHash!: string;

  @Column("json")
  initialState!: SolidityValueType;

  @Column("json")
  latestState!: SolidityValueType;

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

  // Interpreter-related Fields
  @Column("json", { nullable: true })
  outcomeInterpreterParameters?: any;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.appInstances,
  )
  channel!: Channel;
}
