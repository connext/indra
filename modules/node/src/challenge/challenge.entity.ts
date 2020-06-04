import {
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Entity,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  PrimaryColumn,
} from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { IsKeccak256Hash } from "../validate";
import { Channel } from "../channel/channel.entity";
import { utils } from "ethers";
import { AppName, StoredAppChallengeStatus } from "@connext/types";
import { StateProgressedEvent } from "../stateProgressedEvent/stateProgressedEvent.entity";
import { ChallengeUpdatedEvent } from "../challengeUpdatedEvent/challengeUpdatedEvent.entity";
import { toBN } from "@connext/utils";

@Entity()
export class ProcessedBlock {
  @PrimaryColumn("integer", { unique: true })
  blockNumber: number;
}

@Entity()
export class Challenge<T extends AppName = any> {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", {
    transformer: {
      from: (value: string): utils.BigNumber => toBN(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  versionNumber: utils.BigNumber;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash: string;

  @Column("text", {
    transformer: {
      from: (value: string): utils.BigNumber => toBN(value),
      to: (value: utils.BigNumber): string => value.toString(),
    },
  })
  finalizesAt: utils.BigNumber;

  @Column({ type: "enum", enum: StoredAppChallengeStatus })
  status: StoredAppChallengeStatus;

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance<T>;

  @OneToMany((type) => StateProgressedEvent, (event) => event.challenge)
  stateProgressedEvents!: StateProgressedEvent<T>[];

  @OneToMany((type) => ChallengeUpdatedEvent, (event) => event.challenge)
  challengeUpdatedEvents!: ChallengeUpdatedEvent<T>[];

  @ManyToOne((type: any) => Channel)
  channel!: Channel;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
