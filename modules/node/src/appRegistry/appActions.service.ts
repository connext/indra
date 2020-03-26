import {
  SupportedApplication,
  convertWithrawAppState,
  AppState,
  AppAction,
  convertHashLockTransferAppState,
  convertFastSignedTransferAppState,
} from "@connext/apps";
import {
  FastSignedTransferApp,
  SimpleLinkedTransferApp,
  WithdrawApp,
  SimpleLinkedTransferAppState,
  FastSignedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
  HashLockTransferApp,
  HashLockTransferAppState,
  HashLockTransferAppAction,
  FastSignedTransferAppActionBigNumber,
  WithdrawAppState,
  WithdrawAppAction,
  SimpleLinkedTransferAppAction,
  SignedTransferAppAction,
  SignedTransferAppState,
  SimpleSignedTransferApp,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { soliditySha256 } from "ethers/utils";
import { AddressZero, Zero } from "ethers/constants";

import { LoggerService } from "../logger/logger.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { WithdrawService } from "../withdraw/withdraw.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly withdrawService: WithdrawService,
    private readonly cfCoreService: CFCoreService,
    private readonly signedTransferService: SignedTransferService,
    private readonly withdrawRepository: WithdrawRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
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
          action as SimpleLinkedTransferAppAction,
          from,
        );
        break;
      }
      case WithdrawApp: {
        await this.handleWithdrawAppAction(
          appInstanceId,
          action as WithdrawAppAction,
          newState as WithdrawAppState,
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
        break;
      }
      case SimpleSignedTransferApp: {
        await this.handleSignedTransferAppAction(
          appInstanceId,
          newState as SignedTransferAppState,
          action as SignedTransferAppAction,
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
    action: SimpleLinkedTransferAppAction,
    from: string,
  ): Promise<void> {
    const senderApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndReceiver(
      (newState as SimpleLinkedTransferAppState).paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );

    // take action and uninstall
    this.log.log(`Unlocking transfer ${senderApp.identityHash}`);
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      preImage: action.preImage,
    } as SimpleLinkedTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
    this.log.log(`Unlocked transfer ${senderApp.identityHash}`);
  }

  private async handleWithdrawAppAction(
    appInstanceId: string,
    action: WithdrawAppAction,
    state: WithdrawAppState,
  ): Promise<void> {
    let withdraw = await this.withdrawRepository.findByAppInstanceId(appInstanceId);
    if (!withdraw) {
      throw new Error(`No withdraw entity found for this appInstanceId: ${appInstanceId}`);
    }
    withdraw = await this.withdrawRepository.addCounterpartySignatureAndFinalize(
      withdraw,
      action.signature,
    );

    const stateBigNumber = convertWithrawAppState("bignumber", state);
    const appInstance = await this.cfCoreService.getAppInstanceDetails(appInstanceId);
    if (!appInstance) {
      throw new Error(`No channel exists for multisigAddress ${appInstance.multisigAddress}`);
    }

    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: stateBigNumber.transfers[0].amount,
        assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
        recipient: this.cfCoreService.cfCore.freeBalanceAddress,
      },
      appInstance.multisigAddress,
    );
    // TODO: remove any casting by using Signature type
    commitment.signatures = stateBigNumber.signatures as any;
    const tx = await commitment.getSignedTransaction();

    this.log.debug(`Added new action to withdraw entity for this appInstance: ${appInstanceId}`);
    await this.withdrawService.submitWithdrawToChain(appInstance.multisigAddress, tx);
  }

  private async handleHashLockTransferAppAction(
    appInstanceId: string,
    newState: HashLockTransferAppState,
    action: HashLockTransferAppAction,
    from: string,
  ): Promise<void> {
    const lockHash = soliditySha256(["bytes32"], [action.preImage]);
    const apps = await this.appInstanceRepository.findHashLockTransferAppsByLockHash(lockHash);

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
    this.log.info(`Unlocked transfer ${senderApp.identityHash}`);
  }

  private async handleSignedTransferAppAction(
    appInstanceId: string,
    newState: SignedTransferAppState,
    action: SignedTransferAppAction,
    from: string,
  ): Promise<void> {
    const senderApp = await this.signedTransferService.findSenderAppByPaymentId(newState.paymentId);

    if (!senderApp) {
      throw new Error(
        `Action taken on HashLockTransferApp without corresponding sender app! ${appInstanceId}`,
      );
    }

    // take action and uninstall
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      data: action.data,
      signature: action.signature,
    } as SignedTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
    this.log.info(`Unlocked transfer ${senderApp.identityHash}`);
  }
}
