import { AppName, Bytes32, ChallengeUpdatedEventPayload, ChallengeStatus } from "@connext/types";
import { BigNumber } from "ethers";
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
import { IsKeccak256Hash } from "../validate";

export const entityToChallengeUpdatedPayload = (
  item: ChallengeUpdatedEvent | undefined,
  challenge: Challenge,
): ChallengeUpdatedEventPayload | undefined => {
  if (!item) {
    return undefined;
  }
  const { appStateHash, versionNumber, finalizesAt, status } = item;
  return {
    appStateHash,
    versionNumber,
    finalizesAt,
    status,
    identityHash: challenge.app.identityHash,
    chainId: challenge.channel.chainId,
  };
};

@Entity()
export class ChallengeUpdatedEvent<T extends AppName = any> {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne((type: any) => Challenge)
  challenge!: Challenge<T>;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: Bytes32;

  @Column("text", { transformer: transformBN })
  versionNumber!: BigNumber;

  @Column("text", { transformer: transformBN })
  finalizesAt!: BigNumber;

  @Column({ type: "enum", enum: ChallengeStatus })
  status!: ChallengeStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
