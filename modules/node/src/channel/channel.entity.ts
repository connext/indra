import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { IsEthAddress, IsXpub } from "../util";
import { LinkedTransfer } from "../linkedTransfer/linkedTransfer.entity";

@Entity()
export class Channel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text")
  @IsXpub()
  userPublicIdentifier!: string;

  // might not need this
  @Column("text")
  @IsXpub()
  nodePublicIdentifier!: string;

  @Column("text")
  @IsEthAddress()
  multisigAddress!: string;

  @Column("boolean", { default: false })
  available!: boolean;

  @Column("boolean", { default: false })
  collateralizationInFlight!: boolean;

  @ManyToMany(
    (type: any) => RebalanceProfile,
    (profile: RebalanceProfile) => profile.channels,
  )
  @JoinTable()
  rebalanceProfiles!: RebalanceProfile[];

  @OneToMany(
    (type: any) => LinkedTransfer,
    (transfer: LinkedTransfer) => transfer.senderChannel,
  )
  senderLinkedTransfers!: LinkedTransfer[];

  @OneToMany(
    (type: any) => LinkedTransfer,
    (transfer: LinkedTransfer) => transfer.receiverChannel,
  )
  receiverLinkedTransfers!: LinkedTransfer[];

  @OneToMany(
    (type: any) => OnchainTransaction,
    (tx: OnchainTransaction) => tx.channel,
  )
  transactions!: OnchainTransaction[];
}
