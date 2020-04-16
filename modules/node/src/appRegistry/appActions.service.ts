import {
  AppAction,
  AppState,
  HashLockTransferAppAction,
  HashLockTransferAppName,
  HashLockTransferAppState,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppState,
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppName,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  AppInstanceJson,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { soliditySha256 } from "ethers/utils";

import { LoggerService } from "../logger/logger.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { WithdrawService } from "../withdraw/withdraw.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";
import { SupportedApplications } from "@connext/apps";

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
    appName: SupportedApplications,
    app: AppInstanceJson,
    newState: AppState,
    action: AppAction,
    from: string,
  ): Promise<void> {
    this.log.info(
      `handleAppAction for app name ${appName} ${app.identityHash}, action ${JSON.stringify(
        action,
      )} started`,
    );
    switch (appName) {
      case SimpleLinkedTransferAppName: {
        await this.handleSimpleLinkedTransferAppAction(
          app,
          newState as SimpleLinkedTransferAppState,
          action as SimpleLinkedTransferAppAction,
          from,
        );
        break;
      }
      case WithdrawAppName: {
        await this.handleWithdrawAppAction(
          app,
          action as WithdrawAppAction,
          newState as WithdrawAppState,
        );
        break;
      }
      case HashLockTransferAppName: {
        await this.handleHashLockTransferAppAction(
          app,
          newState as HashLockTransferAppState,
          action as HashLockTransferAppAction,
          from,
        );
        break;
      }
      case SimpleSignedTransferAppName: {
        await this.handleSignedTransferAppAction(
          app,
          newState as SimpleSignedTransferAppState,
          action as SimpleSignedTransferAppAction,
          from,
        );
        break;
      }
    }
    this.log.info(
      `handleAppAction for app name ${appName} ${app.identityHash} complete`,
    );
  }

  private async handleSimpleLinkedTransferAppAction(
    appInstance: AppInstanceJson,
    newState: SimpleLinkedTransferAppState,
    action: SimpleLinkedTransferAppAction,
    from: string,
  ): Promise<void> {
    const senderApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndReceiver(
      (newState as SimpleLinkedTransferAppState).paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );

    // take action and uninstall
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      preImage: action.preImage,
    } as SimpleLinkedTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
  }

  private async handleWithdrawAppAction(
    appInstance: AppInstanceJson,
    action: WithdrawAppAction,
    state: WithdrawAppState,
  ): Promise<void> {
    let withdraw = await this.withdrawRepository.findByAppIdentityHash(appInstance.identityHash);
    if (!withdraw) {
      throw new Error(
        `No withdraw entity found for this appIdentityHash: ${appInstance.identityHash}`,
      );
    }
    withdraw = await this.withdrawRepository.addCounterpartySignatureAndFinalize(
      withdraw,
      action.signature,
    );

    const commitment = await this.cfCoreService.createWithdrawCommitment(
      {
        amount: state.transfers[0].amount,
        assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
        recipient: this.cfCoreService.cfCore.signerAddress,
      },
      appInstance.multisigAddress,
    );
    // TODO: remove any casting by using Signature type
    commitment.signatures = state.signatures as any;
    const tx = await commitment.getSignedTransaction();

    this.log.debug(
      `Added new action to withdraw entity for this appInstance: ${appInstance.identityHash}`,
    );
    await this.withdrawService.submitWithdrawToChain(appInstance.multisigAddress, tx);
  }

  private async handleHashLockTransferAppAction(
    appInstance: AppInstanceJson,
    newState: HashLockTransferAppState,
    action: HashLockTransferAppAction,
    from: string,
  ): Promise<void> {
    const lockHash = soliditySha256(["bytes32"], [action.preImage]);
    const apps = await this.appInstanceRepository.findHashLockTransferAppsByLockHash(lockHash);

    // find hashlock transfer app where node is receiver
    // TODO: move to new store
    const senderApp = apps.find(app => {
      const state = app.latestState as HashLockTransferAppState;
      return state.coinTransfers[1].to === this.cfCoreService.cfCore.signerAddress;
    });
    if (!senderApp) {
      throw new Error(
        `Action taken on HashLockTransferApp without corresponding sender app! ${appInstance.identityHash}`,
      );
    }

    // take action and uninstall
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      preImage: action.preImage,
    } as HashLockTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
  }

  private async handleSignedTransferAppAction(
    appInstance: AppInstanceJson,
    newState: SimpleSignedTransferAppState,
    action: SimpleSignedTransferAppAction,
    from: string,
  ): Promise<void> {
    const senderApp = await this.signedTransferService.findSenderAppByPaymentId(newState.paymentId);

    if (!senderApp) {
      throw new Error(
        `Action taken on HashLockTransferApp without corresponding sender app! ${appInstance.identityHash}`,
      );
    }

    // take action and uninstall
    await this.cfCoreService.takeAction(senderApp.identityHash, {
      data: action.data,
      signature: action.signature,
    } as SimpleSignedTransferAppAction);

    await this.cfCoreService.uninstallApp(senderApp.identityHash);
  }
}
