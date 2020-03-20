import {
  ConnextNodeStorePrefix,
  CriticalStateChannelAddresses,
  StateChannelJSON,
} from "@connext/types";
import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { HashZero, AddressZero, Zero } from "ethers/constants";

import { CFCoreRecordRepository } from "../cfCore/cfCore.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { getCreate2MultisigAddress, scanForCriticalAddresses } from "../util";
import { ChannelRepository } from "../channel/channel.repository";
import { CFCoreStore } from "../cfCore/cfCore.store";
import { SetupCommitmentRepository } from "../setupCommitment/setupCommitment.repository";
import { SetupCommitment } from "../setupCommitment/setupCommitment.entity";

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
  ) {
    this.log.setContext("AdminService");
  }

  /////////////////////////////////////////
  ///// GENERAL PURPOSE ADMIN FNS

  /**  Get channels by xpub */
  async getStateChannelByUserPublicIdentifier(
    userPublicIdentifier: string,
  ): Promise<StateChannelJSON> {
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );
    const res = await this.cfCoreService.getStateChannel(channel.multisigAddress);
    return res.data;
  }

  /**  Get channels by multisig */
  async getStateChannelByMultisig(multisigAddress: string): Promise<StateChannelJSON> {
    const res = await this.cfCoreService.getStateChannel(multisigAddress);
    return res.data;
  }

  /** Get all channels */
  async getAllChannels(): Promise<Channel[]> {
    return await this.channelRepository.findAll();
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
      const state = await this.cfCoreStore.getStateChannel(brokenMultisig);
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
      const channel = await this.channelRepository.findByMultisigAddress(state.multisigAddress);
      if (!channel) {
        this.log.warn(`Channel ${state.multisigAddress} could not be found, returning`);
        continue;
      }
      channel.addresses = {
        proxyFactory: criticalAddresses.proxyFactory,
        multisigMastercopy: criticalAddresses.multisigAddress,
      } as CriticalStateChannelAddresses;
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

  async migrateChannelStore(): Promise<boolean> {
    const oldChannelRecords = await this.cfCoreRepository.get(
      `${ConnextNodeStorePrefix}/${this.cfCoreService.cfCore.publicIdentifier}/channel`,
    );
    const channelJSONs: StateChannelJSON[] = Object.values(oldChannelRecords);
    this.log.log(`Found ${channelJSONs.length} old channel records`);
    for (const channelJSON of channelJSONs) {
      try {
        this.log.log(`Found channel to migrate: ${channelJSON.multisigAddress}`);
        // create blank setup commitment
        const setup = new SetupCommitment();
        setup.multisigAddress = channelJSON.multisigAddress;
        setup.to = AddressZero;
        setup.value = Zero;
        setup.data = HashZero;
        await this.setupCommitment.save(setup);

        // check if channel exists
        const channel = await this.channelRepository.findByMultisigAddress(
          channelJSON.multisigAddress,
        );
        if (channel) {
          // update the addresses
          channel.addresses = channelJSON.addresses || {
            proxyFactory: "",
            multisigMastercopy: "",
          }; // dummy value for extra old channels
          // update the store version
          channel.schemaVersion = await this.cfCoreStore.getSchemaVersion();
          await this.channelRepository.save(channel);
        }
        // otherwise, save channel and new channel will have schema
        await this.cfCoreStore.saveStateChannel(channelJSON);

        for (const [, proposedApp] of channelJSON.proposedAppInstances || []) {
          await this.cfCoreStore.saveAppProposal(channelJSON.multisigAddress, proposedApp);
        }

        for (const [, appInstance] of channelJSON.appInstances) {
          await this.cfCoreStore.saveAppInstance(channelJSON.multisigAddress, appInstance);
        }

        await this.cfCoreStore.saveFreeBalance(
          channelJSON.multisigAddress,
          channelJSON.freeBalanceAppInstance,
        );

        // delete old channel record
        const removed = await this.cfCoreRepository.delete({
          path: `${ConnextNodeStorePrefix}/${this.cfCoreService.cfCore.publicIdentifier}/channel/${channelJSON.multisigAddress}`,
        });
        this.log.log(`Migrated channel: ${channelJSON.multisigAddress}`);
        this.log.log(`Removed ${removed.affected} old records after migrating`);
      } catch (e) {
        this.log.error(`Error migrating channel ${channelJSON.multisigAddress}: ${e.toString()}`);
      }
    }
    return true;
  }

  async onApplicationBootstrap() {
    this.log.log(`onApplicationBootstrap migrating channel store.`);
    await this.migrateChannelStore();
    this.log.log(`onApplicationBootstrap completed migrating channel store.`);
  }
}
