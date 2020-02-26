import {
  FastSignedTransferParameters,
  convert,
  AppInstanceJson,
  FastSignedTransferAppState,
  FastSignedTransferAppAction,
  FastSignedTransferActionType,
  ProtocolTypes,
  FastSignedTransferApp,
} from "@connext/types";

import { stringify, xpubToAddress } from "../lib";
import {
  validate,
  notNegative,
  invalidAddress,
  notLessThanOrEqualTo,
  invalid32ByteHexString,
  invalidXpub,
  notLessThan,
} from "../validation";

import { AbstractController } from "./AbstractController";
import { BigNumber } from "ethers/utils";

const findInstalledFastSignedApp = (
  apps: AppInstanceJson[],
  recipientFreeBalanceAddress: string,
  fastSignedTransferAppDefAddress: string,
): AppInstanceJson | undefined => {
  return apps.find(app => {
    const latestState = app.latestState as FastSignedTransferAppState;
    return (
      app.appInterface.addr === fastSignedTransferAppDefAddress && // interface matches
      latestState.coinTransfers[1].to === recipientFreeBalanceAddress // recipient matches
    );
  });
};

export class FastSignedTransferController extends AbstractController {
  public fastLinkedTransfer = async (params: FastSignedTransferParameters) => {
    this.log.info(`fastLinkedTransfer called with params ${stringify(params)}`);

    const {
      amount,
      assetId,
      paymentId,
      preImage,
      recipient,
      maxAllocation,
      meta,
    } = convert.FastSignedTransfer(`bignumber`, params);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalidXpub(recipient),
      notLessThanOrEqualTo(amount, preTransferBal),
      notLessThan(amount, maxAllocation),
      invalid32ByteHexString(paymentId),
      invalid32ByteHexString(preImage),
    );

    const installedApps = await this.connext.getAppInstances();
    const installedTransferApp = findInstalledFastSignedApp(
      installedApps,
      xpubToAddress(recipient),
      this.connext.config.contractAddresses.FastSignedTransfer,
    );

    // assume the app needs to be installed
    let needsInstall = true;
    if (installedTransferApp) {
      const latestState = convert.FastSignedTransferAppState(
        `bignumber`,
        installedTransferApp.latestState as FastSignedTransferAppState,
      );

      // check sender amount
      if (latestState.coinTransfers[0].amount.gt(amount)) {
        // app needs to be finalized and re-installed
        this.log.info(`Installed app does not have funds for transfer, reinstalling`);

        // finalize
        await this.connext.takeAction(installedTransferApp.identityHash, {
          actionType: FastSignedTransferActionType.FINALIZE,
          newLockedPayments: [],
        } as FastSignedTransferAppAction);

        // uninstall
        await this.connext.uninstallApp(installedTransferApp.identityHash);
      } else {
        // app is installed and has funds, can directly take action
        needsInstall = false;
      }

      if (needsInstall) {
        const {
          actionEncoding,
          stateEncoding,
          outcomeType,
          appDefinitionAddress,
        } = this.connext.getRegisteredAppDetails(FastSignedTransferApp);

        
        const installParams = {
          abiEncodings: {
            actionEncoding,
            stateEncoding,
          },
          appDefinition: appDefinitionAddress,
          initialState,
          initiatorDeposit,
          outcomeType,
          proposedToIdentifier,
          responderDeposit,
          timeout,
          initiatorDepositTokenAddress,
          meta,
          responderDepositTokenAddress,
        } as ProtocolTypes.ProposeInstallParams;
      }
    }
  };
}
