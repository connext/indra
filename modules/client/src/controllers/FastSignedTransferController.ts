import {
  convertFastSignedTransferParameters,
  convertFastSignedTransferAppState,
  FastSignedTransferApp,
} from "@connext/apps";
import {
  AppInstanceJson,
  ProtocolTypes,
  FastSignedTransferAppState,
  FastSignedTransferParameters,
  FastSignedTransferActionType,
  FastSignedTransferAppAction,
  minBN,
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
} from "../validation";

import { AbstractController } from "./AbstractController";
import { BigNumber, hexZeroPad } from "ethers/utils";
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
  public fastSignedTransfer = async (params: FastSignedTransferParameters) => {
    this.log.info(`fastSignedTransfer called with params ${stringify(params)}`);
    params.maxAllocation = params.maxAllocation || MaxUint256.toString();

    const {
      amount,
      assetId,
      paymentId,
      recipient,
      maxAllocation,
      meta,
      signer,
    } = convertFastSignedTransferParameters(`bignumber`, params);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      notNegative(amount),
      invalidAddress(assetId),
      invalidXpub(recipient),
      notLessThanOrEqualTo(amount, preTransferBal),
      // amount: 1, maxAllocation: 100
      // eslint-disable-next-line max-len
      notLessThanOrEqualTo(amount, maxAllocation), // if maxAllocation not provided, dont fail this check
      // maxAllocation: 100, preTransferBal: 10
      notLessThanOrEqualTo(maxAllocation.eq(MaxUint256) ? Zero : maxAllocation, preTransferBal),
      invalid32ByteHexString(paymentId),
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
      const latestState = convertFastSignedTransferAppState(
        `bignumber`,
        installedTransferApp.latestState as FastSignedTransferAppState,
      );

      // check sender amount
      if (latestState.coinTransfers[0].amount.gt(amount)) {
        // app needs to be finalized and re-installed
        this.log.info(`Installed app does not have funds for transfer, reinstalling`);

        // uninstall
        await this.connext.uninstallApp(installedTransferApp.identityHash);
      } else {
        // app is installed and has funds, can directly take action
        needsInstall = false;
        transferAppInstanceId = installedTransferApp.identityHash;
      }
    }

    // install if needed
    if (needsInstall) {
      const {
        actionEncoding,
        stateEncoding,
        outcomeType,
        appDefinitionAddress,
      } = this.connext.getRegisteredAppDetails(FastSignedTransferApp);

      // if max allocation not provided, use the full free balnce
      const initialDeposit = minBN([maxAllocation, preTransferBal]);

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
              amount: initialDeposit,
              to: this.connext.freeBalanceAddress,
            },
            // receiver is node
            {
              amount: Zero,
              to: xkeyKthAddress(this.connext.nodePublicIdentifier),
            },
          ],
          finalized: false,
          turnNum: Zero,
          lockedPayments: [], // TODO: figure out if we can add initial state here
        } as FastSignedTransferAppState<BigNumber>,
        proposedToIdentifier: this.connext.nodePublicIdentifier,
        initiatorDeposit: initialDeposit,
        initiatorDepositTokenAddress: assetId,
        responderDeposit: Zero,
        responderDepositTokenAddress: assetId,
        outcomeType,
        timeout: Zero, // TODO
        meta,
      } as ProtocolTypes.ProposeInstallParams;

      transferAppInstanceId = await this.proposeAndInstallLedgerApp(installParams);
    }

    // always take action to create payment
    await this.connext.takeAction(transferAppInstanceId, {
      actionType: FastSignedTransferActionType.CREATE,
      newLockedPayments: [
        {
          amount,
          data: HashZero,
          paymentId,
          receipientXpub: recipient,
          signature: hexZeroPad(HashZero, 65),
          signer,
        },
      ],
    } as FastSignedTransferAppAction<BigNumber>);

    return { transferAppInstanceId };
  };
}
