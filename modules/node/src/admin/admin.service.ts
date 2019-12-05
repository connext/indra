import { StateChannelJSON } from "@connext/types";
import { Injectable } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelService } from "../channel/channel.service";
import { LinkedTransfer } from "../transfer/transfer.entity";
import { TransferService } from "../transfer/transfer.service";
import { CLogger } from "../util";

const logger = new CLogger("AdminService");

@Injectable()
export class AdminService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly transferService: TransferService,
  ) {}

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
    return await this.transferService.getAllLinkedTransfers();
  }

  /** Get transfer */
  // @hunter -- see notes in transfer service fns
  async getLinkedTransferByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.transferService.getLinkedTransferByPaymentId(paymentId);
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
   * October 31, 2019
   *
   * For some as of yet unidentified reason, the multisig address for some
   * channels has changed. This results in 2 channel entries for affected
   * channels. The first was generated around channel creation in from the
   * event data. The second was used to store any subsequent updates.
   *
   * The store entry for `channel/{multisigAddr1}` will have a free balance
   * instance, while the store entry for `channel/{multisigAddr2}` will have
   * all subsequent information regarding channel updates (i.e proposed apps).
   *
   * While this may not be a problem for the functioning of *all* channels,
   * it will be a problem for *any* channel that is restored from the hub.
   * This is because the channels restored by the hub search for the outdated
   * channel state stored under the path `channel/{multisigAddr1}`. It is likely
   * that other, older channels are also affected by this bug.
   *
   * This method will pull out any channel that has a multisigAddress in the
   * channel table, that is different from the expected multisigAddress.
   *
   * Related to bug described in `getNoFreeBalance`.
   */
  async getIncorrectMultisigAddresses(): Promise<
    {
      oldMultisigAddress: string;
      expectedMultisigAddress: string;
      userXpub: string;
      channelId: number;
    }[]
  > {
    const channels = await this.channelService.findAll();
    const ans = [];
    for (const channel of channels) {
      const {
        multisigAddress: oldMultisigAddress,
        userPublicIdentifier: userXpub,
        id: channelId,
      } = channel;
      // calculate the expected multsig address
      const getMultisig = this.cfCoreService.getExpectedMultisigAddressFromUserXpub;
      const expectedMultisigAddress = await getMultisig(userXpub);

      // if it matches, return
      if (expectedMultisigAddress === oldMultisigAddress) {
        continue;
      }

      // otherwise, has incorrect channel addr. from proxy redeployment
      ans.push({
        channelId,
        expectedMultisigAddress,
        oldMultisigAddress,
        userXpub,
      });
    }
    return ans;
  }

  /**
   * November 4, 2019
   *
   * Figure out how many channels that have the ProxyFactory/prefix bug have
   * been updated and need manual channel state merging.
   *
   * There are three cases to merge together:
   *
   * 1. Incorrect prefix, incorrect multisig address
   * 2. Correct prefix, incorrect multisig address
   * 3. Correct prefix, correct multisig address
   *
   * (3) would be the latest `/channel/` entry for the state channel object.
   *
   * There is no reason there would be an incorrect prefix and a correct
   * multisig address since the prefix was changed before the proxy factory
   * was redeployed.
   */
  async getChannelsForMerging(): Promise<any[]> {
    const channels = await this.channelService.findAll();
    // for each of the channels, search for the entries to merge based on
    // outlined possibilities
    const toMerge = [];
    for (const chan of channels) {
      // if the channel has the expected multisig address, assume it
      // will have the correct prefix and will not need to be merged
      // because it was created after latest ProxyFactory deployment
      const expectedMultisig = await this.cfCoreService.getExpectedMultisigAddressFromUserXpub(
        chan.userPublicIdentifier,
      );
      if (expectedMultisig === chan.multisigAddress) {
        continue;
      }
      // otherwise, check to see if there is a channel record with
      // the old prefix
      const oldPrefix = await this.cfCoreService.getChannelRecord(
        chan.multisigAddress,
        "ConnextHub",
      );

      const currPrefix = await this.cfCoreService.getChannelRecord(chan.multisigAddress);

      const latestEntry = await this.cfCoreService.getChannelRecord(expectedMultisig);

      const mergeInfo = {
        channelId: chan.id,
        records: { oldPrefix, currPrefix, latestEntry },
        userXpub: chan.userPublicIdentifier,
      };

      toMerge.push(mergeInfo);
    }

    return toMerge;
  }
}
