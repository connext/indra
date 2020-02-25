import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { IsEthAddress, IsKeccak256Hash } from "src/util";

export enum CommitmentType {
  WITHDRAWAL,
  COMMITMENT,
}

@Entity()
export class Commitment {
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
