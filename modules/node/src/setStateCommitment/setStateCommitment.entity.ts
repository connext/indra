import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
} from "typeorm";
import { AppIdentity, HexString } from "@connext/types";

import { AppInstance } from "../appInstance/appInstance.entity";
import { IsKeccak256Hash, IsEthAddress } from "../validate";

@Entity()
export class SetStateCommitment {
  @PrimaryColumn("text")
  @IsKeccak256Hash()
  appIdentityHash!: string;

  @Column("jsonb")
  appIdentity!: AppIdentity;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: string;

  @Column("text")
  @IsEthAddress()
  challengeRegistryAddress!: string;

  @Column("jsonb", { nullable: true })
  signatures!: string[];

  @Column("text", { nullable: true })
  stateTimeout!: HexString;

  @Column("integer")
  versionNumber!: number;

  @OneToOne((type: any) => AppInstance, { cascade: true })
  @JoinColumn()
  app!: AppInstance;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
