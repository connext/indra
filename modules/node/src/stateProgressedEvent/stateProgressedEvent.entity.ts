import { StateProgressedEventPayload, AppName, AppActions, Address } from "@connext/types";
import { BigNumber, utils } from "ethers";
import {
  PrimaryGeneratedColumn,
  Entity,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

import { Challenge } from "../challenge/challenge.entity";
import { transformBN } from "../utils";
import { IsEthAddress } from "../validate";

const { defaultAbiCoder } = utils;

export const entityToStateProgressedEventPayload = (
  item: StateProgressedEvent | undefined,
  challenge: Challenge,
): StateProgressedEventPayload | undefined => {
  if (!item) {
    return undefined;
  }
  const { action, versionNumber, timeout, turnTaker, signature } = item;
  const encodedAction = defaultAbiCoder.encode([challenge.app.actionEncoding!], [action]);
  return {
    action: encodedAction,
    versionNumber,
    timeout,
    turnTaker,
    signature,
    identityHash: challenge.app.identityHash,
    chainId: challenge.channel.chainId,
  };
};

@Entity()
export class StateProgressedEvent<T extends AppName = any> {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne((type: any) => Challenge)
  challenge!: Challenge<T>;

  @Column("jsonb")
  action!: AppActions[T];

  @Column("text", { transformer: transformBN })
  versionNumber!: BigNumber;

  @Column("text", { transformer: transformBN })
  timeout!: BigNumber;

  @Column("text")
  @IsEthAddress()
  turnTaker!: Address;

  @Column("text")
  signature!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
