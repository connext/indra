import {
  AppAction,
  AppState,
  HashLockTransferAppAction,
  HashLockTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  SimpleSignedTransferAppName,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  AppInstanceJson,
} from "@connext/types";
import { SupportedApplications } from "@connext/apps";
import { Injectable } from "@nestjs/common";
import { utils } from "ethers";

import { LoggerService } from "../logger/logger.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { WithdrawService } from "../withdraw/withdraw.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { SignedTransferService } from "../signedTransfer/signedTransfer.service";
import { HashLockTransferService } from "../hashLockTransfer/hashLockTransfer.service";
import { AppInstance } from "../appInstance/appInstance.entity";
import { getRandomBytes32, stringify } from "@connext/utils";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly withdrawService: WithdrawService,
    private readonly cfCoreService: CFCoreService,
    private readonly signedTransferService: SignedTransferService,
    private readonly hashlockTransferService: HashLockTransferService,
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
  ): Promise<void> {
    this.log.info(
      `handleAppAction for app name ${appName} ${app.identityHash}, action ${JSON.stringify(
        action,
      )} started`,
    );
    switch (appName) {
      case WithdrawAppName: {
        // Special case
        await this.handleWithdrawAppAction(
          app,
          action as WithdrawAppAction,
          newState as WithdrawAppState,
        );
        break;
      }
      case SimpleLinkedTransferAppName: {
        const senderApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndReceiver(
          (newState as SimpleLinkedTransferAppState).paymentId,
          this.cfCoreService.cfCore.signerAddress,
        );
        await this.handleTransferAppAction(senderApp, action);
        break;
      }
      case HashLockTransferAppName: {
        const senderApp = await this.hashlockTransferService.findSenderAppByLockHashAndAssetId(
          utils.soliditySha256(["bytes32"], [(action as HashLockTransferAppAction).preImage]),
          app.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
        );
        if (!senderApp) {
          throw new Error(
            `Action taken on HashLockTransferApp without corresponding sender app! ${app.identityHash}`,
          );
        }
        await this.handleTransferAppAction(senderApp, action);
        break;
      }
      case SimpleSignedTransferAppName: {
        const senderApp = await this.signedTransferService.findSenderAppByPaymentId(
          (newState as SimpleLinkedTransferAppState).paymentId,
        );
        if (!senderApp) {
          throw new Error(
            `Action taken on HashLockTransferApp without corresponding sender app! ${app.identityHash}`,
          );
        }
        await this.handleTransferAppAction(senderApp, action);
        break;
      }
    }
    this.log.info(`handleAppAction for app name ${appName} ${app.identityHash} complete`);
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
        nonce: state.nonce,
      },
      appInstance.multisigAddress,
    );
    await commitment.addSignatures(state.signatures[0], state.signatures[1]);
    const tx = await commitment.getSignedTransaction();

    this.log.debug(
      `Added new action to withdraw entity for this appInstance: ${appInstance.identityHash}`,
    );
    await this.withdrawService.submitWithdrawToChain(appInstance.multisigAddress, tx);
  }

  private async handleTransferAppAction(
    senderApp: AppInstance<any>,
    action: AppAction,
  ): Promise<void> {
    await this.cfCoreService.takeAction(senderApp.identityHash, action);
    await this.cfCoreService.uninstallApp(senderApp.identityHash);
  }
}
