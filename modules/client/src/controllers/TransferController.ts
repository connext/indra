import {
  AppRegistry,
  convert,
  NodeChannel,
  TransferParameters,
  TransferParametersBigNumber,
} from "@connext/types";
import { Node as NodeTypes } from "@counterfactual/types";
import { constants } from "ethers";

import { delay } from "../lib/utils";

import { AbstractController } from "./AbstractController";

const TransferStatuses = {
  FAILED: "FAILED",
  FINALIZED: "FINALIZED",
  INITIATED: "INITIATED",
  INSTALLED: "INSTALLED",
  UNINSTALLED: "UNINSTALLED",
  UPDATED: "UPDATED",
};
type TransferStatus = keyof typeof TransferStatuses;
export class TransferController extends AbstractController {
  private status: TransferStatus = "INITIATED";

  public async transfer(params: TransferParameters): Promise<NodeChannel> {
    this.log.info("Transfer called, yay!");

    if (!params.recipient.startsWith("xpub")) {
      throw new Error("Recipient must be xpub");
    }

    // convert params
    const paramsBig: TransferParametersBigNumber = convert.TransferParameters("bignumber", params);

    // get app definition from constants
    // TODO: this should come from a db on the node
    const appInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    if (!appInfo) {
      throw new Error("Could not find app in registry with supported network");
    }

    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance();
    const preTransferBal = freeBalance[this.connext.wallet.address];
    if (preTransferBal.lt(paramsBig.amount)) {
      throw new Error("Insufficient free balance for proposed transfer.");
    }

    // register all the listeners
    this.registerListeners();

    // TODO: check if recipient has a channel with the hub w/sufficient balance

    // install the transfer application
    // TODO: update if it is token unidirectional
    await this.connext.proposeInstallVirtualApp(
      "EthUnidirectionalTransferApp",
      paramsBig.amount,
      params.recipient, // must be xpub
    );

    // wait 5s for app to be installed correctly
    let retry = 0;
    while (this.status !== "FINALIZED" && retry < 5) {
      this.log.info(
        "App not successfully installed yet, waiting 1 more second before trying to send...",
      );
      retry = retry + 1;
      await delay(1000);
    }

    // if the time passes and there is no app detected, remove
    // all listeners and throw an error
    if (retry >= 5 && this.status !== "FINALIZED") {
      // remove all listeners
      this.removeListeners();
      throw new Error("Could not successfully install + update virtual app after waiting 5s");
    }

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.connext.getFreeBalance();
    const diff = postTransferBal[this.connext.wallet.address].sub(preTransferBal);
    if (!diff.eq(paramsBig.amount)) {
      this.log.debug(
        "Free balance after transfer is gte free balance " +
          "before transfer..... That's not great..",
      );
    }

    // remove any listeners
    this.removeListeners();

    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );

    this.listener.registerCfListener(
      NodeTypes.EventName.INSTALL_VIRTUAL,
      this.installVirtualCallback,
    );

    this.listener.registerCfListener(NodeTypes.EventName.UPDATE_STATE, this.updateStateCallback);

    this.listener.registerCfListener(
      NodeTypes.EventName.UNINSTALL_VIRTUAL,
      this.uninstallVirtualCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );

    this.listener.removeCfListener(
      NodeTypes.EventName.INSTALL_VIRTUAL,
      this.installVirtualCallback,
    );

    this.listener.removeCfListener(NodeTypes.EventName.UPDATE_STATE, this.updateStateCallback);

    this.listener.removeCfListener(
      NodeTypes.EventName.UNINSTALL_VIRTUAL,
      this.uninstallVirtualCallback,
    );
  }

  ////// Listener callbacks
  private async proposeInstallVirtualCallback(data: NodeTypes.ProposeInstallResult): Promise<void> {
    if (this.status !== "INITIATED") {
      return;
    }

    this.log.info(`App proposed install successfully, data ${JSON.stringify(data, null, 2)}`);

    try {
      const installVirtualResponse = await this.connext.installVirtualApp(data.appInstanceId);
      this.log.info(
        `installVirtualResponse result:
        ${installVirtualResponse as NodeTypes.InstallVirtualResult}`,
      );
      this.status = "INSTALLED";
    } catch (e) {
      this.log.error("Node call to propose install virtual app failed.");
      this.log.error(JSON.stringify(e, null, 2));
      this.status = "FAILED";
      this.removeListeners();
    }
  }

  private async installVirtualCallback(data: NodeTypes.InstallVirtualResult): Promise<void> {
    if (this.status !== "INSTALLED") {
      return;
    }

    this.log.info(`App successfully installed, data ${JSON.stringify(data, null, 2)}`);

    // make transfer
    try {
      // TODO: pay all of deposit amount?
      await this.connext.takeAction(data.appInstance.id, {
        finalize: false,
        transferAmount: data.appInstance.myDeposit,
      });
      this.status = "UPDATED";
    } catch (e) {
      this.log.error("Node call to update app state failed.");
      this.log.error(JSON.stringify(e, null, 2));
      this.status = "FAILED";
      this.removeListeners();
    }
  }

  private async updateStateCallback(data: NodeTypes.UpdateStateResult): Promise<void> {
    if (this.status !== "UPDATED") {
      return;
    }

    this.log.info(`App successfully updated, data: ${JSON.stringify(data, null, 2)}`);

    const { appInstanceId } = data as any;

    if (!(data.newState as any).finalized) {
      await this.connext.takeAction(appInstanceId, {
        finalize: true,
        transferAmount: constants.Zero,
      });
      this.status = "FINALIZED";
    }
    // uninstall app on update state
    await this.connext.uninstallVirtualApp(appInstanceId);
  }

  private uninstallVirtualCallback(data: NodeTypes.UninstallVirtualResult): void {
    // should only uninstall if the status of this controller is correct
    if (this.status !== "FINALIZED") {
      return;
    }

    // make sure all listeners are unregistered
    this.log.info(`App successfully uninstalled, data: ${JSON.stringify(data, null, 2)}`);
    this.status = "UNINSTALLED";
    this.removeListeners();
  }
}
