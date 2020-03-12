import {
  SupportedApplication,
  FastSignedTransferApp,
  SimpleLinkedTransferApp,
  WithdrawApp
} from "@connext/apps";
import {
  SimpleLinkedTransferAppState,
  FastSignedTransferAppState,
  SimpleLinkedTransferAppAction,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
  WithdrawAppState,
  WithdrawAppAction,
  FastSignedTransferAppActionBigNumber,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { bigNumberify } from "ethers/utils";
import { AddressZero } from "ethers/constants";

import { ChannelRepository } from "../channel/channel.repository";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { LoggerService } from "../logger/logger.service";
import { LinkedTransferStatus } from "../linkedTransfer/linkedTransfer.entity";
import { FastSignedTransferRepository } from "../fastSignedTransfer/fastSignedTransfer.repository";
import { FastSignedTransferStatus } from "../fastSignedTransfer/fastSignedTransfer.entity";
import { WithdrawRepository } from "../withdraw/withdraw.repository"
import { WithdrawService } from "../withdraw/withdraw.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { FastSignedTransferService } from "../fastSignedTransfer/fastSignedTransfer.service";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly transferService: LinkedTransferService,
    private readonly withdrawService: WithdrawService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly fastSignedTransferService: FastSignedTransferService,
    private readonly cfCoreService: CFCoreService,
    private readonly withdrawRepository: WithdrawRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly fastSignedTransferRepository: FastSignedTransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async handleAppAction(
    appName: SupportedApplication,
    appInstanceId: string,
    newState: SimpleLinkedTransferAppState | FastSignedTransferAppState | WithdrawAppState,
    action: SimpleLinkedTransferAppAction | FastSignedTransferAppAction | WithdrawAppAction,
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
      case WithdrawApp: {
        await this.handleWithdrawAppAction(
          appInstanceId,
          action as WithdrawAppAction,
          newState as WithdrawAppState
        )
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
        await this.linkedTransferService.saveFastSignedTransfer(
          from,
          AddressZero, // TODO
          bigNumberify(action.amount),
          appInstanceId,
          action.signer,
          action.paymentId,
        );
        break;
      }
      case FastSignedTransferActionType.UNLOCK: {
        // update and save transfer status
        let transfer = await this.fastSignedTransferRepository.findByPaymentIdOrThrow(
          action.paymentId,
        );
        transfer.signature = action.signature;
        transfer.data = action.data;
        transfer.status = FastSignedTransferStatus.REDEEMED;
        await this.fastSignedTransferRepository.save(transfer);

        // unlock sender payment, if successful mark as reclaimed
        await this.fastSignedTransferService.reclaimFastSignedTransfer(transfer);
      }
    }
  }

  private async handleSimpleLinkedTransferAppAction(
    appInstanceId: string,
    newState: SimpleLinkedTransferAppState,
    from: string,
  ): Promise<void> {
    let transfer = await this.linkedTransferRepository.findByPaymentIdOrThrow(newState.paymentId);
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
      await this.channelRepository.findByUserPublicIdentifierOrThrow(from),
    );
    this.log.debug(`Marked transfer as redeemed with preImage: ${transfer.preImage}`);
  }

  private async handleWithdrawAppAction(
    appInstanceId: string,
    action: WithdrawAppAction,
    state: WithdrawAppState,
  ): Promise<void> {
    let withdraw = await this.withdrawRepository.findByAppInstanceId(appInstanceId);
    withdraw = await this.withdrawRepository.addCounterpartySignatureAndFinalize(withdraw, action.signature);

    this.log.debug(`Added new action to withdraw entity for this appInstance: ${appInstanceId}`)
    await this.withdrawService.submitWithdrawForNode(appInstanceId, action.signature, state);
  }
}
