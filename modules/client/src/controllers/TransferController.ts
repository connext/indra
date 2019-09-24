import {
  CFCoreChannel,
  convert,
  RegisteredAppDetails,
  SimpleTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
  TransferParameters,
} from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { RejectInstallVirtualMessage } from "../lib/cfCore";
import { freeBalanceAddressFromXpub, replaceBN } from "../lib/utils";
import { invalidAddress, invalidXpub } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  private appId: string;

  private timeout: NodeJS.Timeout;

  public transfer = async (params: TransferParameters): Promise<CFCoreChannel> => {
    this.log.info(`Transfer called with parameters: ${JSON.stringify(params, replaceBN, 2)}`);

    // convert params + validate
    const { recipient, amount, assetId } = convert.TransferParameters("bignumber", params);
    const invalid = await this.validate(recipient, amount, assetId);
    if (invalid) {
      throw new Error(invalid.toString());
    }

    // make sure recipient is online
    // const res = await this.node.recipientOnline(recipient);
    // if (!res) {
    //   throw new Error(`Recipient is offline.`);
    // }

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // verify app is supported without swallowing errors
    const appInfo = this.connext.getRegisteredAppDetails(
      SupportedApplications.SimpleTransferApp as SupportedApplication,
    );

    // install the transfer application
    const appId = await this.transferAppInstalled(amount, recipient, assetId, appInfo);
    if (!appId) {
      throw new Error(`App was not installed`);
    }

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
  private validate = async (
    recipient: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBalance[this.connext.freeBalanceAddress];
    const errs = [
      invalidXpub(recipient),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      this.log.info(
        `Caught INSTALL_VIRTUAL event for different app ${JSON.stringify(data)}, expected ${
          this.appId
        }`,
      );
      // TODO: do we need to recreate the handler here?
      res();
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallTransfer = (
    rej: (reason?: any) => void,
    msg: RejectInstallVirtualMessage, // fix typing, not nested in `.data` obj
  ): any => {
    // check app id
    if (this.appId !== (msg as any).appInstanceId) {
      return;
    }

    return rej(`Install virtual failed. Event data: ${JSON.stringify(msg, replaceBN, 2)}`);
  };

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private transferAppInstalled = async (
    amount: BigNumber,
    recipient: string,
    assetId: string,
    appInfo: RegisteredAppDetails,
  ): Promise<string | undefined> => {
    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    const initialState: SimpleTransferAppStateBigNumber = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddressFromXpub(this.connext.publicIdentifier),
        },
        {
          amount: Zero,
          to: freeBalanceAddressFromXpub(recipient),
        },
      ],
    };

    // note: intermediary is added in connext.ts as well
    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;
    const params: CFCoreTypes.ProposeInstallVirtualParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      // TODO: make initial state types for all apps
      initialState,
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      intermediaryIdentifier: this.connext.nodePublicIdentifier,
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: recipient,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero, // TODO: fix, add to app info?
    };

    const res = await this.connext.proposeInstallVirtualApp(params);
    // set app instance id
    this.appId = res.appInstanceId;

    try {
      await new Promise((res: any, rej: any): any => {
        boundReject = this.rejectInstallTransfer.bind(null, rej);
        boundResolve = this.resolveInstallTransfer.bind(null, res);
        this.listener.on(CFCoreTypes.EventName.INSTALL_VIRTUAL, boundResolve);
        this.listener.on(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
        // this.timeout = setTimeout(() => {
        //   this.cleanupInstallListeners(boundResolve, boundReject);
        //   boundReject({ data: { appInstanceId: this.appId } });
        // }, 5000);
      });
      this.log.info(`App was installed successfully!: ${JSON.stringify(res)}`);
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
