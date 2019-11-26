import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("node_records")
export class CFCoreRecord {
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;

  @PrimaryColumn()
  path!: string;

  @Column({ type: "json" })
  value!: object;
}
