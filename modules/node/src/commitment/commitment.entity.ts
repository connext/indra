import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { IsEthAddress, IsKeccak256Hash } from "../util";

export enum CommitmentType {
  CONDITIONAL,
  WITHDRAWAL,
  SET_STATE,
  SETUP,
}

@Entity()
export class WithdrawCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

  @Column("text", { nullable: true })
  @IsEthAddress()
  multisigAddress!: string;

  @Column("text", { nullable: true })
  @IsKeccak256Hash()
  commitmentHash!: string;

  @Column("json")
  data!: object;
}

@Entity()
export class SetStateCommitmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

  @Column("text")
  appIdentityHash!: string;

  @Column("json")
  appIdentity!: object;

  @Column("text")
  @IsKeccak256Hash()
  appStateHash!: string;

  @Column("challengeRegistryAddress")
  @IsEthAddress()
  challengeRegistryAddress!: string;

  @Column("json", { nullable: true })
  signatures!: object; // Signature[]

  @Column("integer")
  timeout!: number;

  @Column("integer")
  versionNumber!: number;
}

@Entity()
export class ConditionalTransactionCommitmentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("enum", { enum: CommitmentType })
  type!: CommitmentType;

  @Column("text")
  @IsKeccak256Hash()
  appIdentityHash!: string;

  @Column("text")
  @IsKeccak256Hash()
  freeBalanceAppIdentityHash!: string;

  @Column("challengeRegistryAddress")
  @IsEthAddress()
  interpreterAddr!: string;

  @Column("text")
  interpreterParams!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("array")
  multisigOwners!: string[];

  @Column("json")
  networkContext!: object;

  @Column("json", { nullable: true })
  signatures!: object; // Signature[]
}
