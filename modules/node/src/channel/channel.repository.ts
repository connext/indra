import { EntityRepository, Repository } from "typeorm";

import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";

import { Channel, ChannelUpdate, NodeChannel } from "./channel.entity";

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  async findByMultisigAddress(multisigAddress: string): Promise<Channel> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }

  async getPaymentProfileForChannel(userPublicIdentifier: string): Promise<PaymentProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.user", "user")
      .leftJoinAndSelect("channel.paymentProfile", "paymentProfile")
      .where("user.publicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();
    return channel.paymentProfile;
  }
}

@EntityRepository(ChannelUpdate)
export class ChannelUpdateRepository extends Repository<ChannelUpdate> {}

@EntityRepository(NodeChannel)
export class NodeChannelRepository extends Repository<NodeChannel> {
  async findByUserPublicIdentifier(pubId: string): Promise<NodeChannel> {
    return await this.findOne({
      where: { userPublicIdentifier: pubId },
    });
  }

  async findByMultisigAddress(multisigAddress: string): Promise<NodeChannel> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }
}
