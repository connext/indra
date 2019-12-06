import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { CF_METHOD_TIMEOUT, delayAndThrow, stringify, xpubToAddress } from "../lib";
import {
  CFCoreChannel,
  CFCoreTypes,
  convert,
  DefaultApp,
  RejectInstallVirtualMessage,
  SimpleTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
  TransferParameters,
} from "../types";
import { invalidAddress, invalidXpub, notLessThanOrEqualTo, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  private appId: string;

  public transfer = async (params: TransferParameters): Promise<CFCoreChannel> => {
    this.log.info(`Transfer called with parameters: ${stringify(params)}`);

    // convert params + validate
    const { recipient, amount, assetId, meta } = convert.TransferParameters("bignumber", params);
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    validate(
      invalidXpub(recipient),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
    );

    // make sure recipient is online
    // const res = await this.node.recipientOnline(recipient);
    // if (!res) {
    //   throw new Error(`Recipient is offline.`);
    // }

    // verify app is supported without swallowing errors
    const appInfo = this.connext.getRegisteredAppDetails(
      SupportedApplications.SimpleTransferApp as SupportedApplication,
    );

    // install the transfer application
    const appId = await this.transferAppInstalled(amount, recipient, assetId, appInfo, meta);
    if (!appId) {
      throw new Error(`App was not installed`);
    }

    this.log.info(`Uninstalling app ${appId}`);
    await this.connext.uninstallVirtualApp(appId);

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.connext.getFreeBalance(assetId);
    const diff = preTransferBal.sub(postTransferBal[this.connext.freeBalanceAddress]);
    if (!diff.eq(amount)) {
      this.log.info(
        "Welp it appears the difference of the free balance before and after " +
          "uninstalling is not what we expected......",
      );
    } else if (postTransferBal[this.connext.freeBalanceAddress].gte(preTransferBal)) {
      this.log.info(
        "Free balance after transfer is gte free balance " +
          "before transfer..... That's not great..",
      );
    }

    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      this.log.info(
        `Caught INSTALL_VIRTUAL event for different app ${stringify(data)}, expected ${this.appId}`,
      );
      // TODO: do we need to recreate the handler here?
      res();
      return;
    }
    res(data);
    return data;
  };

  private rejectInstallTransfer = (
    rej: (reason?: string) => void,
    msg: RejectInstallVirtualMessage,
  ): void => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    return rej(`Install virtual failed. Event data: ${stringify(msg)}`);
  };

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private transferAppInstalled = async (
    amount: BigNumber,
    recipient: string,
    assetId: string,
    appInfo: DefaultApp,
    meta?: object,
  ): Promise<string | undefined> => {
    let boundResolve: (value?: any) => void;
    let boundReject: (msg: RejectInstallVirtualMessage) => void;

    const initialState: SimpleTransferAppStateBigNumber = {
      coinTransfers: [
        {
          amount,
          to: xpubToAddress(this.connext.publicIdentifier),
        },
        {
          amount: Zero,
          to: xpubToAddress(recipient),
        },
      ],
    };

    // note: intermediary is added in connext.ts as well
    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding, outcomeType } = appInfo;
    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      // TODO: make initial state types for all apps
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: recipient,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero, // TODO: fix, add to app info?
      meta,
    };

    const res = await this.connext.proposeInstallApp(params);
    this.appId = res.appInstanceId;

    try {
      await Promise.race([
        new Promise((res: any, rej: any): any => {
          boundReject = this.rejectInstallTransfer.bind(null, rej);
          boundResolve = this.resolveInstallTransfer.bind(null, res);
          this.listener.on(CFCoreTypes.EventName.INSTALL_VIRTUAL, boundResolve);
          this.listener.on(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
        }),
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App install took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
      ]);
      this.log.info(`App was installed successfully!: ${stringify(res)}`);
      return res.appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.toString()}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundResolve, boundReject);
    }
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(CFCoreTypes.EventName.INSTALL_VIRTUAL, boundResolve);
    this.listener.removeListener(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
  };
}
