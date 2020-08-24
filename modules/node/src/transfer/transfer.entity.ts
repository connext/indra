import {
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  Column,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { IsBytes32 } from "../validate";
import { AppName, AppActions } from "@connext/types";
import { AppInstance } from "../appInstance/appInstance.entity";

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
  action!: AppActions[T];

  @OneToOne((type: any) => AppInstance, { nullable: true, cascade: ["update"] })
  @JoinColumn()
  receiverApp!: AppInstance<T>;

  @OneToOne((type: any) => AppInstance, { nullable: true, cascade: ["update"] })
  @JoinColumn()
  senderApp!: AppInstance<T>;
}
