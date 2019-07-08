import { OutcomeType } from "@counterfactual/types";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum Network {
  GANACHE = "ganache",
  KOVAN = "kovan",
  RINKEBY = "rinkeby",
  ROPSTEN = "ropsten",
  GOERLI = "goerli",
  MAINNET = "mainnet",
}
@Entity()
export class AppRegistry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  name!: string;

  @Column("enum", {
    enum: Network,
  })
  network!: Network;

  @Column("enum", {
    enum: OutcomeType,
  })
  outcomeType!: OutcomeType;

  @Column("text")
  appDefinitionAddress!: string;

  @Column("text")
  stateEncoding!: string;

  @Column("text", { nullable: true })
  actionEncoding!: string;
}
