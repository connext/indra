import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("node_records")
export class CFCoreRecord {
  @PrimaryColumn()
  path!: string;

  @Column({ type: "json" })
  value!: object;
}
