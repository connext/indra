import {
  PrimaryGeneratedColumn,
  Entity,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from "typeorm";

import { Challenge } from "../challenge/challenge.entity";
import { AppName, Bytes32, ChallengeUpdatedEventPayload, ChallengeStatus } from "@connext/types";
import { BigNumber } from "ethers";
import { toBN } from "@connext/utils";
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

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => toBN(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  versionNumber!: BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): BigNumber => toBN(value),
      to: (value: BigNumber): string => value.toString(),
    },
  })
  finalizesAt!: BigNumber;

  @Column({ type: "enum", enum: ChallengeStatus })
  status: ChallengeStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
