import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AppRegistry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  appDefinitionAddress!: string;

  @Column("text")
  stateEncoding!: string;

  @Column("text", { nullable: true })
  actionEncoding!: string;
}
