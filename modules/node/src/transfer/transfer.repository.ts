import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { LinkedTransfer, LinkedTransferStatus, PeerToPeerTransfer } from "./transfer.entity";

@EntityRepository(PeerToPeerTransfer)
export class PeerToPeerTransferRepository extends Repository<PeerToPeerTransfer> {}

@EntityRepository(LinkedTransfer)
export class LinkedTransferRepository extends Repository<LinkedTransfer> {

  async findByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ where: { paymentId } });
  }

  async findByLinkedHash(linkedHash: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ where: { linkedHash } });
  }

  async findByReceiverAppInstanceId(appInstanceId: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ where: { appInstanceId } });
  }

  async markAsRedeemed(
    transfer: LinkedTransfer,
    receiverChannel: Channel,
  ): Promise<LinkedTransfer> {
    transfer.status = LinkedTransferStatus.REDEEMED;
    transfer.receiverChannel = receiverChannel;
    return await this.save(transfer);
  }

  async markAsReclaimed(transfer: LinkedTransfer): Promise<LinkedTransfer> {
    transfer.status = LinkedTransferStatus.RECLAIMED;
    return await this.save(transfer);
  }

  async addPreImage(transfer: LinkedTransfer, preImage: string): Promise<LinkedTransfer> {
    transfer.status = LinkedTransferStatus.REDEEMED;
    transfer.preImage = preImage;
    return await this.save(transfer);
  }
}
