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
import { Zero, MaxUint256, HashZero } from "ethers/constants";

import { stringify, xpubToAddress } from "../lib";
import {
  validate,
  notNegative,
  invalidAddress,
  notLessThanOrEqualTo,
  invalid32ByteHexString,
  invalidXpub,
  notLessThan,
  notGreaterThan,
} from "../validation";

import { AbstractController } from "./AbstractController";
import { BigNumber } from "ethers/utils";
import { xkeyKthAddress } from "@connext/cf-core";

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
      signer,
    } = convert.FastSignedTransfer(`bignumber`, params);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalidXpub(recipient),
      notLessThanOrEqualTo(amount, preTransferBal),
      // eslint-disable-next-line max-len
      notLessThan(amount, maxAllocation || MaxUint256), // if maxAllocation not provided, dont fail this check
      notGreaterThan(maxAllocation || Zero, preTransferBal),
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

    let transferAppInstanceId: string;
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
        } as FastSignedTransferAppAction<BigNumber>);

        // uninstall
        await this.connext.uninstallApp(installedTransferApp.identityHash);
      } else {
        // app is installed and has funds, can directly take action
        needsInstall = false;
        transferAppInstanceId = installedTransferApp.identityHash;
      }
    }

    if (needsInstall) {
      const {
        actionEncoding,
        stateEncoding,
        outcomeType,
        appDefinitionAddress,
      } = this.connext.getRegisteredAppDetails(FastSignedTransferApp);

      // if max allocation not provided, use the full free balnce
      const initalAmount = maxAllocation ? maxAllocation : preTransferBal;

      const installParams = {
        abiEncodings: {
          actionEncoding,
          stateEncoding,
        },
        appDefinition: appDefinitionAddress,
        initialState: {
          coinTransfers: [
            // sender
            {
              amount: initalAmount,
              to: this.connext.freeBalanceAddress,
            },
            // receiver
            {
              amount: Zero,
              to: xkeyKthAddress(recipient),
            },
          ],
          finalized: false,
          turnNum: Zero,
          lockedPayments: [], // TODO: figure out if we can add initial state here
        } as FastSignedTransferAppState<BigNumber>,
        proposedToIdentifier: this.connext.nodePublicIdentifier,
        initiatorDeposit: initalAmount,
        initiatorDepositTokenAddress: assetId,
        responderDeposit: Zero,
        responderDepositTokenAddress: assetId,
        outcomeType,
        timeout: Zero, // TODO
        meta,
      } as ProtocolTypes.ProposeInstallParams;

      transferAppInstanceId = await this.proposeAndInstallLedgerApp(installParams);
    }

    await this.connext.takeAction(transferAppInstanceId, {
      actionType: FastSignedTransferActionType.CREATE,
      newLockedPayments: [
        {
          amount,
          assetId, // TODO: do we need this?
          data: HashZero,
          paymentId,
          receipientXpub: recipient,
          signature: "",
          signer,
          timeout: Zero,
        },
      ],
    } as FastSignedTransferAppAction<BigNumber>);

    return { transferAppInstanceId };
  };
}
