import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from "typeorm";
import { AppIdentity } from "@connext/types";
import { IsKeccak256Hash, IsEthAddress } from "../util";
import { Signature } from "ethers/utils";
import { AppInstance } from "../appInstance/appInstance.entity";

@Entity()
export class SetStateCommitmentEntity {
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
  signatures!: Signature[];

  @Column("integer")
  timeout!: number;

  @Column("integer")
  versionNumber!: number;

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance;
}
