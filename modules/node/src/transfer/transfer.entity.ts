import { Entity, CreateDateColumn, UpdateDateColumn, PrimaryColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { IsBytes32, IsKeccak256Hash } from "../validate";
import { AppName, AppActions } from "@connext/types";
import { AppInstance } from "../appInstance/appInstance.entity";
import { transferPromiseness } from "chai-as-promised";

@Entity()
export class Transfer<T extends AppName> {
  @PrimaryColumn("text")
  @IsBytes32()
  paymentId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column("jsonb", { nullable: true })
  secret!: AppActions[T];

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  receiverApp!: AppInstance<T>

  @OneToOne((type: any) => AppInstance)
  @JoinColumn()
  senderApp!: AppInstance<T>
}