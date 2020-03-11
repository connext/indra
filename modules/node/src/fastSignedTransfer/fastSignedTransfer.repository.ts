import { EntityRepository, Repository } from "typeorm";

import { FastSignedTransfer, FastSignedTransferStatus } from "./fastSignedTransfer.entity";
import { Channel } from "src/channel/channel.entity";

@EntityRepository(FastSignedTransfer)
export class FastSignedTransferRepository extends Repository<FastSignedTransfer> {
  async findByPaymentId(paymentId: string): Promise<FastSignedTransfer | undefined> {
    return await this.findOne({
      relations: ["senderChannel", "receiverChannel"],
      where: { paymentId },
    });
  }

  async findByPaymentIdOrThrow(paymentId: string): Promise<FastSignedTransfer> {
    const transfer = await this.findByPaymentId(paymentId);
    if (!transfer) {
      throw new Error(`No transfer exists for paymentId ${paymentId}`);
    }
    return transfer;
  }

  async findPendingByRecipient(recipientPublicIdentifier: string): Promise<FastSignedTransfer[]> {
    return await this.createQueryBuilder("fastSignedTransfer")
      .leftJoinAndSelect(
        "fastSignedTransfer.receiverChannel",
        "recevierChannel",
        "receiverChannel.userPublicIdentifier = :userPublicIdentifier",
        { userPublicIdentifier: recipientPublicIdentifier },
      )
      .where("fastSignedTransfer.status = :status", { status: FastSignedTransferStatus.PENDING })
      .getMany();
  }

  async findReclaimable(senderChannel: Channel): Promise<FastSignedTransfer[]> {
    return await this.find({
      where: { senderChannel, status: FastSignedTransferStatus.REDEEMED },
    });
  }

  async markAsReclaimed(transfer: FastSignedTransfer): Promise<FastSignedTransfer> {
    transfer.status = FastSignedTransferStatus.RECLAIMED;
    return await this.save(transfer);
  }
}
