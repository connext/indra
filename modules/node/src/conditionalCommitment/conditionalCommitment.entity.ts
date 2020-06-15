import { OneToOne, JoinColumn, Entity, Column, PrimaryColumn } from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { IsEthAddress, IsKeccak256Hash } from "../validate";

@Entity()
export class ConditionalTransactionCommitment {
  @PrimaryColumn()
  @IsKeccak256Hash()
  appIdentityHash!: string;

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

  @OneToOne((type: any) => AppInstance, { cascade: true })
  @JoinColumn()
  app!: AppInstance;
}
