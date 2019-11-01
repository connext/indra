import { Injectable } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { CLogger } from "../util";

const logger = new CLogger("AdminService");

@Injectable()
export class AdminService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
  ) {}

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
      const expectedMultisigAddress = await this.cfCoreService.getExpectedMultisigAddressFromUserXpub(
        userXpub,
      );

      // if it matches, return
      if (expectedMultisigAddress === oldMultisigAddress) {
        continue;
      }

      ans.push({
        channelId,
        expectedMultisigAddress,
        oldMultisigAddress,
        userXpub,
      });
    }
    return ans;
  }
}
