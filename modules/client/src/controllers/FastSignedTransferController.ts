import { convertFastSignedTransferParameters, FastSignedTransferApp } from "@connext/apps";
import { xkeyKthAddress } from "@connext/cf-core";
import {
  AppInstanceJson,
  ProtocolTypes,
  FastSignedTransferAppState,
  FastSignedTransferParameters,
  FastSignedTransferActionType,
  FastSignedTransferAppAction,
  minBN,
  FastSignedTransferAppStateBigNumber,
} from "@connext/types";
import { Zero, MaxUint256, HashZero, AddressZero } from "ethers/constants";

import { stringify, xpubToAddress } from "../lib";
import { validate, notLessThanOrEqualTo } from "../validation";

import { AbstractController } from "./AbstractController";
import { BigNumber, hexZeroPad, bigNumberify } from "ethers/utils";

const findInstalledFastSignedAppWithSpace = (
  apps: AppInstanceJson[],
  recipientFreeBalanceAddress: string,
  fastSignedTransferAppDefAddress: string,
): AppInstanceJson | undefined => {
  return apps.find(app => {
    const latestState = app.latestState as FastSignedTransferAppStateBigNumber;
    return (
      app.appInterface.addr === fastSignedTransferAppDefAddress && // interface matches
      latestState.coinTransfers[1][0] === recipientFreeBalanceAddress // recipient matches
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
      // amount: 1, maxAllocation: 100
      // eslint-disable-next-line max-len
      notLessThanOrEqualTo(amount, maxAllocation), // if maxAllocation not provided, dont fail this check
      // maxAllocation: 100, preTransferBal: 10
      notLessThanOrEqualTo(maxAllocation.eq(MaxUint256) ? Zero : maxAllocation, preTransferBal),
    );

    const installedApps = await this.connext.getAppInstances();
    const installedTransferApp = findInstalledFastSignedAppWithSpace(
      installedApps,
      xpubToAddress(this.connext.nodePublicIdentifier),
      this.connext.config.contractAddresses.FastSignedTransferApp,
    );

    let transferAppInstanceId: string;

    let needsInstall: boolean = true;
    let needsUninstall: string = "";
    // install if needed
    if (installedTransferApp) {
      if (
        bigNumberify(
          (installedTransferApp.latestState as FastSignedTransferAppStateBigNumber)
            .coinTransfers[0][1],
        ).gte(amount)
      ) {
        needsInstall = false;
        transferAppInstanceId = installedTransferApp.identityHash;
      } else {
        // no room in app for transfer, uninstall at the end
        needsUninstall = installedTransferApp.identityHash;
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
          turnNum: Zero,
          amount: Zero,
          paymentId: HashZero,
          recipientXpub: "",
          signer: AddressZero,
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
      console.log("installParams: ", installParams);

      transferAppInstanceId = await this.proposeAndInstallLedgerApp(installParams);
    }

    // always take action to create payment
    // if previous payment has not been resolved, this will error
    await this.connext.takeAction(transferAppInstanceId, {
      actionType: FastSignedTransferActionType.CREATE,
      paymentId,
      amount,
      signer,
      recipientXpub: recipient,
      data: HashZero,
      signature: hexZeroPad(HashZero, 65),
    } as FastSignedTransferAppAction<BigNumber>);

    if (needsUninstall) {
      await this.connext.uninstallApp(needsUninstall);
    }

    return { transferAppInstanceId };
  };
}
