import { toBN, TransferInfo } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Transfer } from "./transfer.entity";

@EntityRepository(Transfer)
export class TransferRepository extends Repository<Transfer> {
  async findByPublicIdentifier(publicIdentifier: string): Promise<TransferInfo[]> {
    const transfers = await this.find({
      where: [
        {
          senderPublicIdentifier: publicIdentifier,
        },
        {
          receiverPublicIdentifier: publicIdentifier,
        },
      ],
    });
    return transfers.map(
      transfer => ({ ...transfer, amount: toBN(transfer.amount) }),
    ) as TransferInfo[];
  }

  async findByPaymentId(paymentId: string): Promise<TransferInfo | undefined> {
    const transfer = await this.findOne({
      where: { paymentId },
    });
    return transfer ? { ...transfer, amount: toBN(transfer.amount) } : undefined;
  }
}
