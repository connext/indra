import { OneToOne, JoinColumn, Entity, Column, PrimaryColumn } from "typeorm";
import { HexString } from "@connext/types";

import { AppInstance } from "../appInstance/appInstance.entity";
import { IsEthAddress, IsKeccak256Hash } from "../validate";

@Entity()
export class ConditionalTransactionCommitment {
  @PrimaryColumn()
  @IsKeccak256Hash()
  appIdentityHash!: HexString;

  @Column("text")
  @IsKeccak256Hash()
  freeBalanceAppIdentityHash!: HexString;

  @Column("text")
  @IsEthAddress()
  interpreterAddr!: HexString;

  @Column("text")
  interpreterParams!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: HexString;

  @Column("text", { array: true })
  multisigOwners!: string[];

  @Column("text")
  transactionData!: HexString;

  @Column("jsonb")
  contractAddresses!: any;

  @Column("text", { array: true, nullable: true })
  signatures!: string[];

  @OneToOne((type: any) => AppInstance, { cascade: true })
  @JoinColumn()
  app!: AppInstance;
}
