import { Column, Entity } from "typeorm";

@Entity()
export class AppRegistry {
  @Column("text")
  appDefinitionAddress: string;

  @Column("text")
  stateEncoding: string;

  @Column("text", { nullable: true })
  actionEncoding: string;
}
