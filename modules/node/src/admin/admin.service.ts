import { Injectable } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { CLogger, stringify } from "../util";

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
  async getNoFreeBalance(): Promise<{ multisigAddress: string; userXpub: string }[]> {
    // get all available channels, meaning theyre deployed
    const channels = await this.channelService.findAll(true);
    const corrupted = [];
    for (const channel of channels) {
      // try to get the free balance of eth
      // note: this is brittle, could check the state channel obj
      // key itself
      try {
        await this.cfCoreService.getFreeBalance(
          channel.userPublicIdentifier,
          channel.multisigAddress,
        );
      } catch (e) {
        if (e.includes(`There is no free balance app instance installed in this state channel`)) {
          corrupted.push({
            multisigAddress: channel.multisigAddress,
            userXpub: channel.userPublicIdentifier,
          });
        } else {
          logger.warn(
            `Caught unexpected error trying to get free balance of channel: ${stringify(
              channel,
              2,
            )}. Error: ${stringify(e, 2)}`,
          );
        }
      }
    }
    return corrupted;
  }
}
