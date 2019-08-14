import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { LinkedTransfer, LinkedTransferStatus, PeerToPeerTransfer } from "./transfer.entity";

@EntityRepository(PeerToPeerTransfer)
export class PeerToPeerTransferRepository extends Repository<PeerToPeerTransfer> {}

@EntityRepository(LinkedTransfer)
export class LinkedTransferRepository extends Repository<LinkedTransfer> {
  async findByLinkedHash(linkedHash: string): Promise<LinkedTransfer | undefined> {
    return await this.findOne({ where: { linkedHash } });
  }

  async markAsRedeemed(
    transfer: LinkedTransfer,
    receiverChannel: Channel,
  ): Promise<LinkedTransfer> {
    transfer.status = LinkedTransferStatus.REDEEMED;
    transfer.receiverChannel = receiverChannel;
    return await this.save(transfer);
  }
}
