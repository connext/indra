import { AppName, StoredAppChallengeStatus } from "@connext/types";
import { BigNumber } from "ethers";
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
import { Channel } from "../channel/channel.entity";
import { ChallengeUpdatedEvent } from "../challengeUpdatedEvent/challengeUpdatedEvent.entity";
import { StateProgressedEvent } from "../stateProgressedEvent/stateProgressedEvent.entity";
import { transformBN } from "../utils";
import { IsKeccak256Hash } from "../validate";

@Entity()
export class ProcessedBlock {
  @PrimaryColumn("integer", { unique: true })
  blockNumber!: number;
}

@Entity()
export class Challenge<T extends AppName = any> {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", { transformer: transformBN })
  versionNumber!: BigNumber;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: string;

  @Column("text", { transformer: transformBN })
  finalizesAt!: BigNumber;

  @Column({ type: "enum", enum: StoredAppChallengeStatus })
  status!: StoredAppChallengeStatus;

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance<T>;

  @OneToMany((type) => StateProgressedEvent, (event) => event.challenge)
  stateProgressedEvents!: StateProgressedEvent<T>[];

  @OneToMany((type) => ChallengeUpdatedEvent, (event) => event.challenge)
  challengeUpdatedEvents!: ChallengeUpdatedEvent<T>[];

  @ManyToOne((type: any) => Channel, (channel) => channel.challenges)
  channel!: Channel;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
