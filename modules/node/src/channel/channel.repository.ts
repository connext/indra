import { EntityRepository, Repository } from "typeorm";

import { Channel, ChannelUpdate, NodeChannel } from "./channel.entity";

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
  async findByMultisigAddress(multisigAddress: string): Promise<Channel> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }
}

@EntityRepository(ChannelUpdate)
export class ChannelUpdateRepository extends Repository<ChannelUpdate> {}

@EntityRepository(NodeChannel)
export class NodeChannelRepository extends Repository<NodeChannel> {
  async findByPublicIdentifier(pubId: string): Promise<NodeChannel> {
    return await this.findOne({
      where: [{ nodePublicIdentifier: pubId }, { userPublicIdentifier: pubId }],
    });
  }

  async findByMultisigAddress(multisigAddress: string): Promise<NodeChannel> {
    return await this.findOne({
      where: { multisigAddress },
    });
  }
}
