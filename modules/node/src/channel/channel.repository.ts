import { EntityRepository, Repository } from "typeorm";

import { Channel, ChannelUpdate, NodeChannel } from "./channel.entity";

@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {}

@EntityRepository(ChannelUpdate)
export class ChannelUpdateRepository extends Repository<ChannelUpdate> {}

@EntityRepository(NodeChannel)
export class NodeChannelRepository extends Repository<NodeChannel> {
  async findByXpub(xpub: string): Promise<NodeChannel> {
    return await this.findOne({ where: [{ nodeXpub: xpub }, { counterpartyXpub: xpub }] });
  }
}
