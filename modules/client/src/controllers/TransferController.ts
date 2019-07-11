import { convert, NodeChannel, TransferParameters } from "@connext/types";
import { RejectInstallVirtualMessage } from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { constants } from "ethers";
import { BigNumber } from "ethers/utils";

import { delay } from "../lib/utils";
import { invalidAddress, invalidXpub } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  private appId: string;

  private timeout: NodeJS.Timeout;

  public transfer = async (params: TransferParameters): Promise<NodeChannel> => {
    this.log.info(`Transfer called with parameters: ${JSON.stringify(params, null, 2)}`);

    // convert params + validate
    const { recipient, amount, assetId } = convert.TransferParameters("bignumber", params);
    const invalid = await this.validate(recipient, amount, assetId);
    if (invalid) {
      throw new Error(invalid.toString());
    }

    // check that there is sufficient free balance for amount
    const preTransferBal = (await this.connext.getFreeBalance())[
      this.cfModule.ethFreeBalanceAddress
    ];

    // TODO: check if the recipient is the node, and if so transfer without
    // installing an app (is this possible?)

    // TODO: check if recipient has a channel with the hub w/sufficient balance
    // or if there is a route available through the node

    // install the transfer application
    try {
      await this.transferAppInstalled(amount, recipient);
    } catch (e) {
      // TODO: can add more checks in `rejectInstall` but there is no
      // way to check if the recipient is collateralized atm, so just
      // assume this is the reason the install was rejected
      throw new Error("Recipient online, but does not have sufficient collateral");
    }

    // update state
    // TODO: listener for reject state?
    await this.connext.takeAction(this.appId, {
      finalize: false,
      transferAmount: amount,
    });

    // finalize state + uninstall application
    await this.finalizeAndUninstallApp(this.appId);

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.connext.getFreeBalance();
    const diff = preTransferBal.sub(postTransferBal[this.cfModule.ethFreeBalanceAddress]);
    if (!diff.eq(amount)) {
      this.log.info(
        "Welp it appears the difference of the free balance before and after " +
          "uninstalling is not what we expected......",
      );
    } else if (postTransferBal[this.cfModule.ethFreeBalanceAddress].gte(preTransferBal)) {
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
    const freeBalance = await this.connext.getFreeBalance();
    const preTransferBal = freeBalance[this.cfModule.ethFreeBalanceAddress];
    const errs = [
      invalidXpub(recipient),
      invalidAddress(assetId),
      notLessThanOrEqualTo(amount, preTransferBal),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: any, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallTransfer = (rej: any, data: RejectInstallVirtualMessage): any => {
    // check app id
    if (this.appId !== data.data.appInstanceId) {
      return;
    }

    rej(`Install virtual rejected. Event data: ${JSON.stringify(data, null, 2)}`);
    return data;
  };

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private transferAppInstalled = async (amount: BigNumber, recipient: string): Promise<any> => {
    let boundResolve;
    let boundReject;

    const res = await this.connext.proposeInstallVirtualApp(
      "EthUnidirectionalTransferApp",
      amount,
      recipient, // must be xpub
    );
    // set app instance id
    this.appId = res.appInstanceId;

    await new Promise((res, rej) => {
      boundReject = this.rejectInstallTransfer.bind(null, rej);
      boundResolve = this.resolveInstallTransfer.bind(null, res);
      this.listener.on(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
      this.listener.on(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
      this.timeout = setTimeout(() => {
        this.cleanupInstallListeners(boundResolve, boundReject);
        boundReject({ data: { data: this.appId } });
      }, 5000);
    });

    this.cleanupInstallListeners(boundResolve, boundReject);
    return res.appInstanceId;
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
    this.listener.removeListener(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
  };

  private finalizeAndUninstallApp = async (appId: string): Promise<void> => {
    await this.connext.takeAction(appId, {
      finalize: true,
      transferAmount: constants.Zero,
    });

    await this.connext.uninstallVirtualApp(appId);
    // TODO: cf does not emit uninstall virtual event on the node
    // that has called this function but ALSO does not immediately
    // uninstall the apps. This will be a problem when trying to
    // display balances...
    const openApps = await this.connext.getAppInstances();
    this.log.info(`Open apps: ${openApps.length}`);
    this.log.info(`AppIds: ${JSON.stringify(openApps.map(a => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await new Promise(async (res, rej) => {
      const getAppIds = async (): Promise<string[]> => {
        return (await this.connext.getAppInstances()).map((a: AppInstanceInfo) => a.identityHash);
      };
      let retries = 0;
      while ((await getAppIds()).indexOf(this.appId) !== -1 && retries <= 5) {
        this.log.info("found app id in the open apps... retrying...");
        await delay(500);
        retries = retries + 1;
      }

      if (retries > 5) rej();

      res();
    });
  };
}
