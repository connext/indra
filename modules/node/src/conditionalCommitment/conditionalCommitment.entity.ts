import { IsEthAddress, IsKeccak256Hash } from "../util";
import { AppInstance } from "../appInstance/appInstance.entity";
import { OneToOne, JoinColumn, PrimaryGeneratedColumn, Entity, Column } from "typeorm";

@Entity()
export class ConditionalTransactionCommitment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  @IsKeccak256Hash()
  freeBalanceAppIdentityHash!: string;

  @Column("text")
  @IsEthAddress()
  interpreterAddr!: string;

  @Column("text")
  interpreterParams!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("text", { array: true })
  multisigOwners!: string[];

  @Column("text", { array: true, nullable: true })
  signatures!: string[];

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  app!: AppInstance;
}
