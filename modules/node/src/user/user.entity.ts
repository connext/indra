import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import { IsEthAddress } from "../validator/isEthAddress";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  @IsXpub()
  xpubId: string;

  @Column("text")
  @IsEthAddress()
  signingKey: string;
}
