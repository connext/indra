import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";

import { mockNodePublicIdentifier } from "./cfCore";
import { mkXpub } from "./utils";

export async function createTestChannel(
  channelRepository: ChannelRepository,
  userXpub: string = mkXpub("xpubA"),
  multisigAddress: string = mkXpub("0xbeef"),
): Promise<Channel> {
  const channel = new Channel();
  channel.multisigAddress = multisigAddress;
  channel.nodePublicIdentifier = mockNodePublicIdentifier;
  channel.userPublicIdentifier = userXpub;
  return await channelRepository.save(channel);
}
