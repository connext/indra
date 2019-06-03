import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  email: string;

  @Column("text")
  ethAddress: string;

  @Column("text")
  nodeAddress: string;

  @Column("text", {
    nullable: true,
  })
  multisigAddress: string;

  @Column("text")
  username: string;
}
