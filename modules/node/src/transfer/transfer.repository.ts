import { EntityRepository, Repository } from "typeorm";

import { Transfer } from "./transfer.entity";

@EntityRepository(Transfer)
export class TransferRepository extends Repository<Transfer> {
  async findByPublicIdentifier(publicIdentifier: string): Promise<Transfer[]> {
    return await this.find({
      where: [
        {
          senderPublicIdentifier: publicIdentifier,
        },
        {
          receiverPublicIdentifier: publicIdentifier,
        },
      ],
    });
  }

  async findByPaymentId(paymentId: string): Promise<Transfer> {
    return await this.findOne({
      where: { paymentId },
    });
  }
}
