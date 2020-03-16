import {
  SimpleLinkedTransferAppState,
  FastSignedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
  FastSignedTransferApp,
  SimpleLinkedTransferApp,
  HashLockTransferApp,
  HashLockTransferAppState,
  HashLockTransferAppAction,
  FastSignedTransferAppActionBigNumber,
} from "@connext/types";
import {
  SupportedApplication,
  AppState,
  AppAction,
  convertHashLockTransferAppState,
  convertFastSignedTransferAppState,
} from "@connext/apps";
import { Injectable } from "@nestjs/common";
import { soliditySha256 } from "ethers/utils";
import { AddressZero, Zero } from "ethers/constants";

import { ChannelRepository } from "../channel/channel.repository";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { LoggerService } from "../logger/logger.service";
import { LinkedTransferStatus } from "../linkedTransfer/linkedTransfer.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { FastSignedTransferService } from "../fastSignedTransfer/fastSignedTransfer.service";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly fastSignedTransferService: FastSignedTransferService,
    private readonly cfCoreService: CFCoreService,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async handleAppAction(
    appName: SupportedApplication,
    appInstanceId: string,
    newState: AppState,
    action: AppAction,
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
      case HashLockTransferApp: {
        await this.handleHashLockTransferAppAction(
          appInstanceId,
          newState as HashLockTransferAppState,
          action as HashLockTransferAppAction,
          from,
        );
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
        break;
      }
      case FastSignedTransferActionType.UNLOCK: {
        const apps = await this.cfCoreService.getFastSignedTransferAppsByPaymentId(
          action.paymentId,
        );

        // find hashlock transfer app where node is receiver
        // TODO: move to new store
        const senderApp = apps.find(app => {
          const state = convertFastSignedTransferAppState(
            "bignumber",
            app.latestState as FastSignedTransferAppState,
          );
          return state.coinTransfers[1].to === this.cfCoreService.cfCore.freeBalanceAddress;
        });
        if (!senderApp) {
          throw new Error(
            `Action UNLOCK taken on FastSignedTransferApp without corresponding sender app! ${appInstanceId}`,
          );
        }
        const senderAppState = convertFastSignedTransferAppState(
          "bignumber",
          senderApp.latestState as FastSignedTransferAppState,
        );

        const senderAppAction = {
          actionType: FastSignedTransferActionType.UNLOCK,
          data: action.data,
          paymentId: action.paymentId,
          signature: action.signature,
          recipientXpub: senderAppState.recipientXpub, // not checked
          amount: Zero, // not checked
          signer: AddressZero, // not checked
        } as FastSignedTransferAppActionBigNumber;
        await this.cfCoreService.takeAction(senderApp.identityHash, senderAppAction);
        this.log.log(`Unlocked transfer from ${senderApp.identityHash}`);
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
        `Not updating transfer preImage or marking as redeemed for sender update state events`,
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

  private async handleHashLockTransferAppAction(
    appInstanceId: string,
    newState: HashLockTransferAppState,
    action: HashLockTransferAppAction,
    from: string,
  ): Promise<void> {
    const lockHash = soliditySha256(["bytes32"], [action.preImage]);
    const apps = await this.cfCoreService.getHashLockTransferAppsByLockHash(lockHash);

    // find hashlock transfer app where node is receiver
    // TODO: move to new store
    const senderApp = apps.find(app => {
      const state = convertHashLockTransferAppState(
        "bignumber",
        app.latestState as HashLockTransferAppState,
      );
      return state.coinTransfers[1].to === this.cfCoreService.cfCore.freeBalanceAddress;
    });
    if (!senderApp) {
      throw new Error(
        `Action taken on HashLockTransferApp without corresponding sender app! ${appInstanceId}`,
      );
    }

    // take action and uninstall
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      preImage: action.preImage,
    } as HashLockTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
    this.log.info(`Reclaimed collateral from ${senderApp.identityHash}`);
  }
}
