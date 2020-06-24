import {
  AppActions,
  AppName,
  AppStates,
  HexString,
  OutcomeType,
  TwoPartyFixedOutcomeInterpreterParamsJson,
  MultiAssetMultiPartyCoinTransferInterpreterParamsJson,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
} from "@connext/types";
import { BigNumber } from "ethers";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

import { Channel } from "../channel/channel.entity";
import { IsEthAddress, IsKeccak256Hash, IsValidPublicIdentifier } from "../validate";

export enum AppType {
  PROPOSAL = "PROPOSAL",
  INSTANCE = "INSTANCE",
  FREE_BALANCE = "FREE_BALANCE",
  REJECTED = "REJECTED", // removed proposal
  UNINSTALLED = "UNINSTALLED", // removed app
}

@Entity()
export class AppInstance<T extends AppName = any> {
  @PrimaryColumn("text")
  @IsKeccak256Hash()
  identityHash!: string;

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

  @Column("jsonb")
  latestState!: AppStates[T];

  @Column("integer")
  latestVersionNumber!: number;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  initiatorDeposit!: BigNumber;

  @Column("text")
  @IsEthAddress()
  initiatorDepositAssetId!: string;

  @Column({ type: "enum", enum: OutcomeType })
  outcomeType!: OutcomeType;

  @Column("text")
  @IsValidPublicIdentifier()
  initiatorIdentifier!: string;

  @Column("text")
  @IsValidPublicIdentifier()
  responderIdentifier!: string;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => BigNumber.from(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  responderDeposit!: BigNumber;

  @Column("text")
  @IsEthAddress()
  responderDepositAssetId!: string;

  @Column("text")
  defaultTimeout!: HexString;

  @Column("text", { nullable: true })
  stateTimeout!: HexString;

  @Column("jsonb", { nullable: true })
  meta!: any;

  @Column("jsonb", { nullable: true })
  latestAction!: AppActions[T];

  @Column("jsonb")
  outcomeInterpreterParameters!:
    | TwoPartyFixedOutcomeInterpreterParamsJson
    | MultiAssetMultiPartyCoinTransferInterpreterParamsJson
    | SingleAssetTwoPartyCoinTransferInterpreterParamsJson
    | {};

  @ManyToOne((type: any) => Channel, (channel: Channel) => channel.appInstances, { nullable: true })
  channel!: Channel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
