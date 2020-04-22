import { getCreate2MultisigAddress, scanForCriticalAddresses } from "@connext/cf-core";
import {
  CriticalStateChannelAddresses,
  StateChannelJSON,
} from "@connext/types";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { ChannelRepository, convertChannelToJSON } from "../channel/channel.repository";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

export interface RepairCriticalAddressesResponse {
  fixed: string[];
  broken: string[];
}

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly cfCoreStore: CFCoreStore,
    private readonly setupCommitment: SetupCommitmentRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("AdminService");
  }

  /////////////////////////////////////////
  ///// GENERAL PURPOSE ADMIN FNS

  /**  Get channels by address */
  async getStateChannelByUserPublicIdentifier(
    userIdentifier: string,
  ): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userIdentifier,
    );
    return convertChannelToJSON(channel);
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
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userAddress: string; error: any }[]> {
    // get all available channels, meaning theyre deployed
    const channels = await this.channelService.findAll();
    const corrupted = [];
    for (const channel of channels) {
      // try to get the free balance of eth
      const { id, multisigAddress, userIdentifier: userAddress } = channel;
      try {
        await this.cfCoreService.getFreeBalance(userAddress, multisigAddress);
      } catch (error) {
        corrupted.push({
          error: error.message,
          id,
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
        channelId: chan.id,
        records: { oldPrefix, currPrefix },
        userAddress: chan.userIdentifier,
      };
      toMerge.push(mergeInfo);
    }
    return toMerge;
  }

  /**
   * January 21, 2020
   *
   * Retrieves all the state channels with missing or invalid critical addresses
   * Finds the critical addresses needed to deploy each broken state deposit holder
   * Add these critical addresses to the channel's state
   */
  async repairCriticalStateChannelAddresses(): Promise<RepairCriticalAddressesResponse> {
    const states = await Promise.all(
      (await this.getAllChannels()).map(channel =>
        this.cfCoreStore.getStateChannel(channel.multisigAddress),
      ),
    );
    const output: RepairCriticalAddressesResponse = { fixed: [], broken: [] };
    this.log.info(`Scanning ${states.length} channels to see if any need to be repaired..`);
    // First loop: Identify all channels that need to be repaired
    for (const state of states) {
      if (
        !state.addresses ||
        !state.addresses.proxyFactory ||
        !state.addresses.multisigMastercopy ||
        state.multisigAddress !==
          (await getCreate2MultisigAddress(
            state.userIdentifiers[0],
            state.userIdentifiers[1],
            state.addresses,
            this.configService.getEthProvider(),
          ))
      ) {
        output.broken.push(state.multisigAddress);
      }
    }
    if (output.broken.length === 0) {
      this.log.info("No channels need to be repaired, great!");
      return output;
    }
    this.log.info(`Preparing to repair ${output.broken.length} channels`);
    // Make a copy of broken multisigs so we can edit the output while looping through it
    const brokenMultisigs = JSON.parse(JSON.stringify(output.broken));
    // Second loop: attempt to repair broken channels
    for (const brokenMultisig of brokenMultisigs) {
      const state = await this.cfCoreStore.getStateChannel(brokenMultisig);
      this.log.info(`Searching for critical addresses needed to fix channel ${brokenMultisig}..`);
      const criticalAddresses = await scanForCriticalAddresses(
        state.userIdentifiers[0],
        state.userIdentifiers[1],
        state.multisigAddress,
        this.configService.getEthProvider(),
      );
      if (!criticalAddresses) {
        this.log.warn(
          `Could not find critical addresses that would fix channel ${state.multisigAddress}`,
        );
        continue;
      }
      if (criticalAddresses.toxicBytecode) {
        this.log.warn(
          `Channel ${state.multisigAddress} was created with toxic bytecode, it is unrepairable`,
        );
      } else if (criticalAddresses.legacyKeygen) {
        this.log.warn(
          `Channel ${state.multisigAddress} was created with legacyKeygen, it needs to be repaired manually`,
        );
      }
      this.log.info(`Found critical addresses that fit, repairing channel: ${brokenMultisig}`);
      const channel = await this.channelRepository.findByMultisigAddress(state.multisigAddress);
      if (!channel) {
        this.log.warn(`Channel ${state.multisigAddress} could not be found, returning`);
        continue;
      }
      channel.addresses = {
        proxyFactory: criticalAddresses.proxyFactory,
        multisigMastercopy: criticalAddresses.multisigAddress,
      } as CriticalStateChannelAddresses;
      // @ts-ignore TS2589: Type instantiation is excessively deep and possibly infinite.
      await this.channelRepository.save(channel);
      // Move this channel from broken to fixed
      output.fixed.push(brokenMultisig);
      output.broken = output.broken.filter(multisig => multisig === brokenMultisig);
    }
    if (output.broken.length > 0) {
      this.log.warn(`${output.broken.length} channels could not be repaired`);
    }
    return output;
  }

  async onApplicationBootstrap() {}
}
