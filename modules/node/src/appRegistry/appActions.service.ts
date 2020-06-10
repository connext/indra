import {
  AppAction,
  AppState,
  WithdrawAppAction,
  WithdrawAppName,
  WithdrawAppState,
  AppInstanceJson,
  ConditionalTransferAppNames,
  SupportedApplicationNames,
  SingleAssetTwoPartyCoinTransferInterpreterParams,
  SingleAssetTwoPartyCoinTransferInterpreterParamsJson,
} from "@connext/types";
import { Injectable } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { WithdrawRepository } from "../withdraw/withdraw.repository";
import { WithdrawService } from "../withdraw/withdraw.service";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { TransferService } from "../transfer/transfer.service";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly withdrawService: WithdrawService,
    private readonly cfCoreService: CFCoreService,
    private readonly transferService: TransferService,
    private readonly withdrawRepository: WithdrawRepository,
  ) {
    this.log.setContext("AppRegistryService");
  }

  async handleAppAction(
    appName: SupportedApplicationNames,
    app: AppInstanceJson,
    newState: AppState,
    action: AppAction,
  ): Promise<void> {
    this.log.info(
      `handleAppAction for app name ${appName} ${app.identityHash}, action ${JSON.stringify(
        action,
      )} started`,
    );

    if (Object.keys(ConditionalTransferAppNames).includes(appName)) {
      const senderApp = await this.transferService.findSenderAppByPaymentId(app.meta.paymentId);
      if (!senderApp) {
        throw new Error(
          `Action taken on tranfer app without corresponding sender app! ${app.identityHash}`,
        );
      }
      await this.handleTransferAppAction(senderApp, action);
    } else if (appName === WithdrawAppName) {
      await this.handleWithdrawAppAction(
        app,
        action as WithdrawAppAction,
        newState as WithdrawAppState,
      );
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
        assetId: (appInstance.outcomeInterpreterParameters as SingleAssetTwoPartyCoinTransferInterpreterParamsJson)
          .tokenAddress,
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
    // App could be uninstalled, which means the channel is no longer
    // associated with this app instance
    if (senderApp.type !== AppType.INSTANCE) {
      return;
    }
    await this.cfCoreService.uninstallApp(
      senderApp.identityHash,
      senderApp.channel.multisigAddress,
      action,
    );
  }
}
