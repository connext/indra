import {
  ConnextNodeStorePrefix,
  CriticalStateChannelAddresses,
  StateChannelJSON,
} from "@connext/types";
import { Injectable } from "@nestjs/common";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { LinkedTransfer } from "../linkedTransfer/linkedTransfer.entity";
import { LoggerService } from "../logger/logger.service";
import { getCreate2MultisigAddress, scanForCriticalAddresses } from "../util";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";

export interface RepairCriticalAddressesResponse {
  fixed: string[];
  broken: string[];
}

@Injectable()
export class AdminService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly cfCoreRepository: CFCoreRecordRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
  ) {
    this.log.setContext("AdminService");
  }

  /////////////////////////////////////////
  ///// GENERAL PURPOSE ADMIN FNS

  /**  Get channels by xpub */
  async getStateChannelByUserPublicIdentifier(
    userPublicIdentifier: string,
  ): Promise<StateChannelJSON> {
    return await this.channelService.getStateChannel(userPublicIdentifier);
  }

  /**  Get channels by multisig */
  async getStateChannelByMultisig(multisigAddress: string): Promise<StateChannelJSON> {
    return await this.channelService.getStateChannelByMultisig(multisigAddress);
  }

  /** Get all channels */
  async getAllChannels(): Promise<Channel[]> {
    return await this.channelService.getAllChannels();
  }

  /** Get all transfers */
  // @hunter -- see notes in transfer service fns
  async getAllLinkedTransfers(): Promise<LinkedTransfer[]> {
    return await this.linkedTransferRepository.findAll();
  }

  /** Get transfer */
  // @hunter -- see notes in transfer service fns
  async getLinkedTransferByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.linkedTransferRepository.findByPaymentId(paymentId);
  }

  /////////////////////////////////////////
  ///// PURPOSE BUILT ADMIN FNS

  /**
   * October 30, 2019
   *
   * Some channels do not have a `freeBalanceAppInstance` key stored in their
   * state channel object at the path:
   * `{prefix}/{nodeXpub}/channel/{multisigAddress}`, meaning any attempts that
   * rely on checking the free balance (read: all app protocols) will fail.
   *
   * Additionally, any `restoreState` or state migration methods will fail
   * since they will be migrating corrupted states.
   *
   * This method will return the userXpub and the multisig address for all
   * channels that fit this description.
   */
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userXpub: string; error: any }[]> {
    // get all available channels, meaning theyre deployed
    const channels = await this.channelService.findAll();
    const corrupted = [];
    for (const channel of channels) {
      // try to get the free balance of eth
      const { id, multisigAddress, userPublicIdentifier: userXpub } = channel;
      try {
        await this.cfCoreService.getFreeBalance(userXpub, multisigAddress);
      } catch (error) {
        corrupted.push({
          error: error.message,
          id,
          multisigAddress,
          userXpub,
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
        userXpub: chan.userPublicIdentifier,
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
    const states = (
      await Promise.all(
        (await this.getAllChannels()).map(channel =>
          this.cfCoreService.getStateChannel(channel.multisigAddress),
        ),
      )
    ).map(state => state.data);
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
            state.userNeuteredExtendedKeys,
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
      const { data: state } = await this.cfCoreService.getStateChannel(brokenMultisig);
      this.log.info(`Searching for critical addresses needed to fix channel ${brokenMultisig}..`);
      const criticalAddresses = await scanForCriticalAddresses(
        state.userNeuteredExtendedKeys,
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
      const repoPath = `${ConnextNodeStorePrefix}/${this.cfCoreService.cfCore.publicIdentifier}/channel/${brokenMultisig}`;
      const cfCoreRecord = await this.cfCoreRepository.get(repoPath);
      cfCoreRecord["addresses"] = {
        proxyFactory: criticalAddresses.proxyFactory,
        multisigMastercopy: criticalAddresses.multisigMastercopy,
      } as CriticalStateChannelAddresses;
      await this.cfCoreRepository.set([
        {
          path: repoPath,
          value: cfCoreRecord,
        },
      ]);
      // Move this channel from broken to fixed
      output.fixed.push(brokenMultisig);
      output.broken = output.broken.filter(multisig => multisig === brokenMultisig);
    }
    if (output.broken.length > 0) {
      this.log.warn(`${output.broken.length} channels could not be repaired`);
    }
    return output;
  }
}
