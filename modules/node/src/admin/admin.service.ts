import { StateChannelJSON } from "@connext/types";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelService } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { ChannelRepository, ChannelSerializer } from "../channel/channel.repository";
import { CFCoreStore } from "../cfCore/cfCore.store";

export interface RepairCriticalAddressesResponse {
  fixed: string[];
  broken: string[];
}

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    private readonly cfCoreStore: CFCoreStore,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("AdminService");
  }

  /////////////////////////////////////////
  ///// GENERAL PURPOSE ADMIN FNS

  /**  Get channels by address */
  async getStateChannelByUserPublicIdentifier(userIdentifier: string): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userIdentifier);
    return ChannelSerializer.toJSON(channel);
  }

  /**  Get channels by multisig */
  async getStateChannelByMultisig(multisigAddress: string): Promise<StateChannelJSON> {
    return this.cfCoreStore.getStateChannel(multisigAddress);
  }

  /** Get all channels */
  async getAllChannels(): Promise<Channel[]> {
    return this.channelRepository.findAll();
  }

  /** Get all transfers */
  // @hunter -- see notes in transfer service fns
  async getAllLinkedTransfers(): Promise<any> {
    throw new Error(`Not implemented`);
  }

  /** Get transfer */
  // @hunter -- see notes in transfer service fns
  async getLinkedTransferByPaymentId(paymentId: string): Promise<any> {
    throw new Error(`Not implemented`);
  }

  /////////////////////////////////////////
  ///// PURPOSE BUILT ADMIN FNS

  /**
   * October 30, 2019
   *
   * Some channels do not have a `freeBalanceAppInstance` key stored in their
   * state channel object at the path:
   * `{prefix}/{nodeAddress}/channel/{multisigAddress}`, meaning any attempts that
   * rely on checking the free balance (read: all app protocols) will fail.
   *
   * Additionally, any `restoreState` or state migration methods will fail
   * since they will be migrating corrupted states.
   *
   * This method will return the userAddress and the multisig address for all
   * channels that fit this description.
   */
  async getNoFreeBalance(): Promise<
    { multisigAddress: string; userAddress: string; error: any }[]
  > {
    // get all available channels, meaning theyre deployed
    const channels = await this.channelService.findAll();
    const corrupted = [];
    for (const channel of channels) {
      // try to get the free balance of eth
      const { multisigAddress, userIdentifier: userAddress } = channel;
      try {
        await this.cfCoreService.getFreeBalance(userAddress, multisigAddress);
      } catch (error) {
        corrupted.push({
          error: error.message,
          multisigAddress,
          userAddress,
        });
      }
    }
    return corrupted;
  }

  /**
   * November 4, 2019
   *
   * Figure out how many channels that have the prefix bug have
   * been updated and need manual channel state merging.
   */
  async getChannelsForMerging(): Promise<any[]> {
    const channels = await this.channelService.findAll();
    // for each of the channels, search for the entries to merge based on
    // outlined possibilities
    const toMerge = [];
    for (const chan of channels) {
      const oldPrefix = await this.cfCoreService.getChannelRecord(
        chan.multisigAddress,
        "ConnextHub",
      );
      const currPrefix = await this.cfCoreService.getChannelRecord(chan.multisigAddress);
      const mergeInfo = {
        records: { oldPrefix, currPrefix },
        userAddress: chan.userIdentifier,
      };
      toMerge.push(mergeInfo);
    }
    return toMerge;
  }

  async onApplicationBootstrap() {}
}
