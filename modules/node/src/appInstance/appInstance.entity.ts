import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { IsEthAddress, IsKeccak256Hash, IsXpub } from "../util";
import { SolidityValueType, OutcomeType, AppABIEncodings } from "@connext/types";

import { Channel } from "../channel/channel.entity";

export enum AppType {
  PROPOSAL,
  INSTANCE,
  FREE_BALANCE,
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

  @Column("json")
  abiEncodings!: AppABIEncodings;

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

  @Column("text")
  initiatorDeposit!: string;

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

  @Column("text")
  responderDeposit!: string;

  @Column("text")
  @IsEthAddress()
  responderDepositTokenAddress!: string;

  @Column("text")
  timeout!: string;

  // Interpreter-related Fields
  @Column("json", { nullable: true })
  twoPartyOutcomeInterpreterParams?: any;

  @Column("json", { nullable: true })
  multiAssetMultiPartyCoinTransferInterpreterParams?: any;

  @Column("json", { nullable: true })
  singleAssetTwoPartyCoinTransferInterpreterParams?: any;

  @ManyToOne(
    (type: any) => Channel,
    (channel: Channel) => channel.appInstances,
  )
  channel!: Channel;
}
