import { Injectable } from "@nestjs/common";

import { ChannelRepository } from "../channel/channel.repository";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { LoggerService } from "../logger/logger.service";
import {
  SupportedApplication,
  FastSignedTransferApp,
  SimpleLinkedTransferApp,
} from "@connext/apps";
import {
  SimpleLinkedTransferAppState,
  FastSignedTransferAppState,
  SimpleLinkedTransferAppAction,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
} from "@connext/types";
import { LinkedTransferStatus } from "../linkedTransfer/linkedTransfer.entity";
import { bigNumberify } from "ethers/utils";
import { AddressZero } from "ethers/constants";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly channelRepository: ChannelRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly log: LoggerService,
    private readonly transferService: LinkedTransferService,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async handleAppAction(
    appName: SupportedApplication,
    appInstanceId: string,
    newState: SimpleLinkedTransferAppState | FastSignedTransferAppState,
    action: SimpleLinkedTransferAppAction | FastSignedTransferAppAction,
    from: string,
  ): Promise<void> {
    switch (appName) {
      case FastSignedTransferApp: {
        await this.handleFastSignedTransferAppAction(
          appInstanceId,
          newState as FastSignedTransferAppState,
          action as FastSignedTransferAppAction,
          from,
        );
        break;
      }
      case SimpleLinkedTransferApp: {
        await this.handleSimpleLinkedTransferAppAction(
          appInstanceId,
          newState as SimpleLinkedTransferAppState,
          from,
        );
        break;
      }
    }
  }

  private async handleFastSignedTransferAppAction(
    appInstanceId: string,
    newState: FastSignedTransferAppState,
    action: FastSignedTransferAppAction,
    from: string,
  ): Promise<void> {
    switch (action.actionType) {
      case FastSignedTransferActionType.CREATE: {
        for (const lockedPayment of action.newLockedPayments) {
          await this.transferService.saveFastSignedTransfer(
            from,
            AddressZero, // TODO
            bigNumberify(lockedPayment.amount),
            appInstanceId,
            lockedPayment.signer,
            lockedPayment.paymentId,
          );
        }
        break;
      }
      case FastSignedTransferActionType.UNLOCK: {
      }
    }
  }

  private async handleSimpleLinkedTransferAppAction(
    appInstanceId: string,
    newState: SimpleLinkedTransferAppState,
    from: string,
  ): Promise<void> {
    let transfer = await this.linkedTransferRepository.findByPaymentId(newState.paymentId);
    if (!transfer) {
      throw new Error(`Transfer does not exist! ${appInstanceId}`);
    }
    if (appInstanceId !== transfer.receiverAppInstanceId) {
      this.log.debug(
        `Not updating transfer preimage or marking as redeemed for sender update state events`,
      );
      return;
    }
    // update transfer
    transfer.preImage = newState.preImage;

    if (
      transfer.status === LinkedTransferStatus.RECLAIMED ||
      transfer.status === LinkedTransferStatus.REDEEMED
    ) {
      this.log.warn(
        `Got update state event for a receiver's transfer app (transfer.id: ${transfer.id}) with unexpected status: ${transfer.status}`,
      );
      return;
    }

    // transfers are set to `PENDING` when created. They are set to
    // `FAILED` when the receiver rejects an install event. If a transfer
    // makes it to the `UPDATE_STATE_EVENT` portion, it means the transfer
    // was successfully installed. There is no reason to not redeem it in
    // that case.
    transfer = await this.linkedTransferRepository.markAsRedeemed(
      transfer,
      await this.channelRepository.findByUserPublicIdentifier(from),
    );
    this.log.debug(`Marked transfer as redeemed with preImage: ${transfer.preImage}`);
  }
}
