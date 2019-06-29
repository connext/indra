import {
  AppRegistry,
  convert,
  NodeChannel,
  TransferParameters,
  TransferParametersBigNumber,
} from "@connext/types";
import { Node as NodeTypes } from "@counterfactual/types";
import { constants } from "ethers";

import { ConnextInternal } from "../connext";
import { delay } from "../lib/utils";

import { AbstractController } from "./AbstractController";
import { UpdateStateMessage, UninstallVirtualMessage, InstallVirtualMessage, RejectInstallVirtualMessage, ProposeVirtualMessage } from "@counterfactual/node";

const DEFAULT_DELAY = 1000;
const RETRIES = 30;

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
  private params: TransferParametersBigNumber;

  constructor(name: string, connext: ConnextInternal) {
    super(name, connext);

    // bind callbacks
    this.proposeInstallVirtualCallback = this.proposeInstallVirtualCallback.bind(this);
    this.rejectInstallVirtualCallback = this.rejectInstallVirtualCallback.bind(this);
    this.installVirtualCallback = this.installVirtualCallback.bind(this);
    this.updateStateCallback = this.updateStateCallback.bind(this);
    this.uninstallVirtualCallback = this.uninstallVirtualCallback.bind(this);
  }

  public async transfer(params: TransferParameters): Promise<NodeChannel> {
    this.log.info(`Transfer called with parameters: ${JSON.stringify(params, null, 2)}`);

    if (!params.recipient.startsWith("xpub")) {
      throw new Error("Recipient must be xpub");
    }

    // convert params
    const paramsBig: TransferParametersBigNumber = convert.TransferParameters("bignumber", params);
    this.params = paramsBig;

    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance();

    const preTransferBal = freeBalance[this.cfModule.ethFreeBalanceAddress];

    if (preTransferBal.lt(paramsBig.amount)) {
      throw new Error("Insufficient free balance for proposed transfer.");
    }

    // TODO: check if the recipient is the node, and if so transfer without
    // installing an app

    // get app definition from constants
    // TODO: this should come from a db on the node
    const appInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    if (!appInfo) {
      throw new Error("Could not find app in registry with supported network");
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
    while (this.status !== "FINALIZED" && retry < RETRIES) {
      if (this.status === "FAILED") {
        break;
      }
      this.log.info(
        "App not successfully installed yet, waiting 1 more second before trying to send...",
      );
      retry = retry + 1;
      await delay(DEFAULT_DELAY);
    }

    // if the time passes and there is no app detected, remove
    // all listeners and throw an error
    if (retry >= RETRIES && this.status !== "FINALIZED") {
      // remove all listeners
      this.removeListeners();
      throw new Error("Could not successfully install + update virtual app after waiting 10s");
    }

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.connext.getFreeBalance();
    const diff = postTransferBal[this.cfModule.ethFreeBalanceAddress].sub(preTransferBal);
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
    this.log.info("Registering the listeners.....");
    this.listener.registerCfListener(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );

    this.listener.registerCfListener(
      NodeTypes.EventName.REJECT_INSTALL_VIRTUAL,
      this.rejectInstallVirtualCallback,
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
    this.log.info("Registered!");
  }

  private removeListeners(): void {
    this.log.info("Removing listeners.....");
    this.listener.removeCfListener(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );

    this.listener.removeCfListener(
      NodeTypes.EventName.REJECT_INSTALL_VIRTUAL,
      this.rejectInstallVirtualCallback,
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
    this.log.info("Removed!");
  }

  ////// Listener callbacks
  private async proposeInstallVirtualCallback(data: ProposeVirtualMessage): Promise<void> {
    this.log.info(`App proposed install successfully, data ${JSON.stringify(data, null, 2)}`);

    if (this.status !== "INITIATED") {
      return;
    }

    try {
      const installVirtualResponse = await this.connext.installVirtualApp(data.data.appInstanceId);
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

  private async rejectInstallVirtualCallback(data: RejectInstallVirtualMessage): Promise<void> {
    this.log.info(
      `App rejected the proposed virtual install, data ${JSON.stringify(data, null, 2)}`,
    );

    if (this.status !== "INSTALLED") {
      return;
    }

    this.status = "FAILED";
    this.removeListeners();
  }

  private async installVirtualCallback(data: InstallVirtualMessage): Promise<void> {
    this.log.info(`App successfully installed, data ${JSON.stringify(data, null, 2)}`);

    if (this.status !== "INSTALLED" && this.status !== "INITIATED") {
      return;
    }

    // make transfer
    const { appInstanceId } = data.data.params;
    try {
      this.log.info(`Making payment in app for ${this.params.amount.toString()} ETH`);
      this.status = "UPDATED";
      await this.connext.takeAction(appInstanceId, {
        finalize: false,
        transferAmount: this.params.amount,
      });
    } catch (e) {
      this.log.error("Node call to update app state failed.");
      this.log.error(JSON.stringify(e, null, 2));
      this.status = "FAILED";
      this.removeListeners();
    }
  }

  private async updateStateCallback(emitted: UpdateStateMessage): Promise<void> {
    this.log.info(`App successfully updated, data: ${JSON.stringify(emitted, null, 2)}`);

    if (this.status !== "UPDATED") {
      this.log.info(`status: ${this.status}`);
      return;
    }

    const { appInstanceId, newState } = emitted.data;

    if (!(newState as any).finalized) {
      await this.connext.takeAction(appInstanceId, {
        finalize: true,
        transferAmount: constants.Zero,
      });
      this.status = "FINALIZED";
      // uninstall app on update state
      await this.connext.uninstallVirtualApp(appInstanceId);
    }
  }

  private uninstallVirtualCallback(data: UninstallVirtualMessage): void {
    this.log.info(`App successfully uninstalled, data: ${JSON.stringify(data, null, 2)}`);

    // should only uninstall if the status of this controller is correct
    if (this.status !== "FINALIZED") {
      return;
    }

    // make sure all listeners are unregistered
    this.status = "UNINSTALLED";
    this.removeListeners();
  }
}
