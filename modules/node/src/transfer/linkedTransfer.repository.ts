import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { LinkedTransfer, LinkedTransferStatus } from "./linkedTransfer.entity";

@EntityRepository(LinkedTransfer)
export class LinkedTransferRepository extends Repository<LinkedTransfer> {
  async findByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ relations: ["senderChannel"], where: { paymentId } });
  }

  async findByPaymentIdOrThrow(paymentId: string): Promise<LinkedTransfer | undefined> {
    const transfer = await this.findByPaymentId(paymentId);
    if (!transfer) {
      throw new Error(`No transfer exists for paymentId ${paymentId}`);
    }
    return transfer;
  }

  async findByLinkedHash(linkedHash: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ relations: ["senderChannel"], where: { linkedHash } });
  }

  async findByReceiverAppInstanceId(appInstanceId: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ where: { receiverAppInstanceId: appInstanceId } });
  }

  async findPendingByRecipient(recipientPublicIdentifier: string): Promise<LinkedTransfer[]> {
    return await this.find({
      where: { recipientPublicIdentifier, status: LinkedTransferStatus.PENDING },
    });
  }

  async findReclaimable(senderChannel: Channel): Promise<LinkedTransfer[]> {
    return await this.find({
      where: { senderChannel, status: LinkedTransferStatus.REDEEMED },
    });
  }

  async findAll(): Promise<LinkedTransfer[]> {
    return await this.find();
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

  async addRecipientPublicIdentifierAndEncryptedPreImage(
    transfer: LinkedTransfer,
    receiverChannel: Channel,
    encryptedPreImage: string,
  ): Promise<LinkedTransfer> {
    transfer.receiverChannel = receiverChannel;
    transfer.recipientPublicIdentifier = receiverChannel.userPublicIdentifier;
    transfer.encryptedPreImage = encryptedPreImage;
    return await this.save(transfer);
  }
}
