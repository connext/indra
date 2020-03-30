import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { AppIdentity } from "@connext/types";
import { IsKeccak256Hash, IsEthAddress } from "../util";
import { AppInstance } from "../appInstance/appInstance.entity";

@Entity()
export class SetStateCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("json")
  appIdentity!: AppIdentity;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: string;

  @Column("text")
  @IsEthAddress()
  challengeRegistryAddress!: string;

  @Column("json", { nullable: true })
  signatures!: string[];

  @Column("integer")
  timeout!: number;

  @Column("integer")
  versionNumber!: number;

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
