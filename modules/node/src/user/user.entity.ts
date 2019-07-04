import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import { IsXpub } from "../validator/isXpub";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  @IsXpub()
  publicIdentifier!: string;
}
