import { EntityRepository, Repository } from "typeorm";

import { defaultPaymentProfile } from "../constants";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";

import { Channel } from "./channel.entity";

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  async findByMultisigAddress(multisigAddress: string): Promise<Channel | undefined> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }

  async findByUserPublicIdentifier(userPublicIdentifier: string): Promise<Channel | undefined> {
    return await this.findOne({
      where: { userPublicIdentifier },
    });
  }

  async getPaymentProfileForChannel(userPublicIdentifier: string): Promise<PaymentProfile> {
    const channel = await this.createQueryBuilder("channel")
      .leftJoinAndSelect("channel.user", "user")
      .leftJoinAndSelect("channel.paymentProfile", "paymentProfile")
      .where("user.publicIdentifier = :userPublicIdentifier", { userPublicIdentifier })
      .getOne();

    if (!channel.paymentProfile) {
      return defaultPaymentProfile;
    }
    return channel.paymentProfile;
  }
}
