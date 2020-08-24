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
  appIdentityHash!: HexString;

  @Column("jsonb")
  appIdentity!: AppIdentity;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: HexString;

  @Column("text")
  @IsEthAddress()
  challengeRegistryAddress!: HexString;

  @Column("jsonb", { nullable: true })
  signatures!: string[];

  @Column("text", { nullable: true })
  stateTimeout!: HexString;

  @Column("text")
  transactionData!: HexString;

  @Column("integer")
  versionNumber!: number;

  @OneToOne((type: any) => AppInstance, { cascade: true })
  @JoinColumn()
  app!: AppInstance;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
