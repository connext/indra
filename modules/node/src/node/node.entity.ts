import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("node_records")
export class NodeRecord {
  @PrimaryColumn()
  path!: string;

  @Column({ type: "json" })
  value!: object;
}
