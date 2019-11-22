import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("node_records")
export class CFCoreRecord {
  @CreateDateColumn({
    default: Date.now(),
  })
  createdAt!: Date;

  @UpdateDateColumn({
    default: Date.now(),
  })
  updatedAt!: Date;

  @PrimaryColumn()
  path!: string;

  @Column({ type: "json" })
  value!: object;
}
