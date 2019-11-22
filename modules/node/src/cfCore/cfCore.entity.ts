import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("node_records")
export class CFCoreRecord {
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @PrimaryColumn()
  path!: string;

  @Column({ type: "json" })
  value!: object;
}
