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
import { utils } from "ethers";
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
      from: (value: string): utils.BigNumber => toBN(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  versionNumber!: utils.BigNumber;

  @Column("text", {
    transformer: {
      from: (value: string): utils.BigNumber => toBN(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  finalizesAt!: utils.BigNumber;

  @Column({ type: "enum", enum: ChallengeStatus })
  status: ChallengeStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
