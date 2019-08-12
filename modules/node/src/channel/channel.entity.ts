import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { Transfer } from "../transfer/transfer.entity";
import { IsEthAddress } from "../validator/isEthAddress";
import { IsXpub } from "../validator/isXpub";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("citext")
  @IsXpub()
  userPublicIdentifier!: string;

  // might not need this
  @Column("citext")
  @IsXpub()
  nodePublicIdentifier!: string;

  @Column("citext")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("boolean", { default: false })
  available!: boolean;

  @ManyToMany((type: any) => PaymentProfile, (profile: PaymentProfile) => profile.channels)
  @JoinTable()
  paymentProfiles!: PaymentProfile[];

  @OneToMany((type: any) => Transfer, (transfer: Transfer) => transfer.senderChannel)
  senderTransfers!: Transfer[];

  @OneToMany((type: any) => Transfer, (transfer: Transfer) => transfer.receiverChannel)
  receiverTransfers!: Transfer[];
}
