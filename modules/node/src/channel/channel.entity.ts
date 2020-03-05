import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { RebalanceProfile } from "../rebalanceProfile/rebalanceProfile.entity";
import { IsEthAddress, IsXpub } from "../util";
import { FastSignedTransfer } from "../transfer/fastSignedTransfer.entity";
import { PeerToPeerTransfer } from "../transfer/peerToPeerTransfer.entity";
import { LinkedTransfer } from "../transfer/linkedTransfer.entity";

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
    (type: any) => FastSignedTransfer,
    (transfer: FastSignedTransfer) => transfer.senderChannel,
  )
  senderFastSignedTransfers!: FastSignedTransfer[];

  @OneToMany(
    (type: any) => FastSignedTransfer,
    (transfer: FastSignedTransfer) => transfer.receiverChannel,
  )
  receiverFastSignedTransfers!: FastSignedTransfer[];

  @OneToMany(
    (type: any) => LinkedTransfer,
    (transfer: LinkedTransfer) => transfer.senderChannel,
  )
  senderPeerToPeerTransfers!: LinkedTransfer[];

  @OneToMany(
    (type: any) => PeerToPeerTransfer,
    (transfer: PeerToPeerTransfer) => transfer.receiverChannel,
  )
  receiverPeerToPeerTransfers!: PeerToPeerTransfer[];

  @OneToMany(
    (type: any) => OnchainTransaction,
    (tx: OnchainTransaction) => tx.channel,
  )
  transactions!: OnchainTransaction[];
}
