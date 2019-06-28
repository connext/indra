import {
  AppRegistry,
  AppState,
  AppStateBigNumber,
  BigNumber,
  ChannelState,
  convert,
  TransferParameters,
  TransferParametersBigNumber,
} from "@connext/types";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";

import { delay } from "../lib/utils";

import { AbstractController } from "./AbstractController";
import { constants } from "ethers";

export class TransferController extends AbstractController {
  private appInstanceId: undefined | string;
  private successfullyInstalled: boolean = false;
  private amount: BigNumber;

  public async transfer(params: TransferParameters): Promise<ChannelState> {
    this.log.info("Transfer called, yay!");

    if (!params.recipient.startsWith("xpub")) {
      throw new Error("Recipient must be xpub");
    }

    // convert params
    const paramsBig: TransferParametersBigNumber = convert.TransferParameters("bignumber", params);
    this.amount = paramsBig.amount;

    // get app definition from constants
    // TODO: this should come from a db on the node
    const appInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    if (!appInfo) {
      throw new Error("Could not find app in registry with supported network");
    }

    // check that there is sufficient free balance for amount
    const freeBalance = await this.connext.getFreeBalance();
    if (freeBalance[this.connext.wallet.address].lt(paramsBig.amount)) {
      throw new Error("Insufficient free balance for proposed transfer.");
    }

    this.registerListeners();

    // TODO: check if recipient has a channel with the hub w/sufficient balance

    // if previously installed app exists, use that
    // by only making one payment in the app, the calls will remain
    // idempotent since the amount deposited == the payment amount
    const matched = await this.getMatchingApplication();

    if (matched) {
      this.appInstanceId = matched.transferApp[0].id;
      this.successfullyInstalled = true;
      // if the matched app state has a nonzero receiver balance,
      // uninstall and remove all listeners
      const stateBig: AppStateBigNumber = convert.AppState("bignumber", matched.state);
      // TODO: well want some type of runtime state to make sure
      // wallets or users can communicate whats happening to end users
      // TODO: transfer ordering? whos balance is first and is it consistent?
      if (!stateBig.transfers[1].amount.isZero()) {
        // a payment has been made in this application, uninstall it
        this.log.info(
          `It appears a payment has already been made, this app should
           be uninstalled. Info: ${JSON.stringify(matched, null, 2)}`,
        );
        await this.updateStateCallback({
          appInstanceId: this.appInstanceId,
          newState: { finalized: false },
        } as any);
      }
      // TODO: what happens if user refreshes or goes to another
      // device? Is this idempotent enough?
    } else {
      // install the transfer application
      // TODO: update if it is token unidirectional
      await this.connext.proposeInstallVirtualApp(
        "EthUnidirectionalTransferApp",
        paramsBig.amount,
        params.recipient, // must be xpub
      );
    }

    // wait 5s for app to be installed correctly
    let retry = 0;
    while (!this.successfullyInstalled && retry < 5) {
      this.log.info(
        "App not successfully installed yet, waiting 1 more second before trying to send...",
      );
      retry = retry + 1;
      await delay(1000);
    }

    // if the time passes and there is no app detected, remove
    // all listeners and throw an error
    if (retry >= 5 && !this.successfullyInstalled) {
      // remove all listeners
      this.removeListeners();
      throw new Error("Could not successfully install virtual app after waiting 5s");
    }

    // TODO: sanity check, free balance decreased by payment amount
    // remove any listeners
    this.removeListeners();

    return {} as ChannelState;
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
    this.appInstanceId = data.appInstanceId;

    try {
      const installVirtualResponse = await this.connext.installVirtualApp(this.appInstanceId);
      this.log.info(
        `installVirtualResponse result:
        ${installVirtualResponse as NodeTypes.InstallVirtualResult}`,
      );
    } catch (e) {
      this.log.error("Node call to propose install virtual app failed.");
      this.log.error(JSON.stringify(e, null, 2));
      this.successfullyInstalled = false;
      this.removeListeners();
    }
  }

  private async installVirtualCallback(data: NodeTypes.InstallVirtualResult): Promise<void> {
    this.log.info(`App successfully installed, data ${JSON.stringify(data, null, 2)}`);
    this.successfullyInstalled = true;
    // make payment
    try {
      // TODO: pay all of deposit amount?
      await this.connext.takeAction(data.appInstance.id, {
        finalize: false,
        transferAmount: data.appInstance.myDeposit,
      });
    } catch (e) {
      this.log.error("Node call to update app state failed.");
      this.log.error(JSON.stringify(e, null, 2));
      this.removeListeners();
    }
  }

  private async updateStateCallback(data: NodeTypes.UpdateStateResult): Promise<void> {
    this.log.info(`App successfully updated, data: ${JSON.stringify(data, null, 2)}`);
    const { appInstanceId } = data as any;
    // make sure event is updating our app
    // and the state is not already finalized
    if (appInstanceId !== this.appInstanceId) {
      return;
    }
    if (!(data.newState as any).finalized) {
      await this.connext.takeAction(appInstanceId, {
        finalize: true,
        transferAmount: constants.Zero,
      });
    }
    // uninstall app on update state
    await this.connext.uninstallVirtualApp(this.appInstanceId);
  }

  private uninstallVirtualCallback(data: NodeTypes.UninstallVirtualResult): void {
    // make sure all listeners are unregistered
    this.log.info(`App successfully uninstalled, data: ${JSON.stringify(data, null, 2)}`);
    this.removeListeners();
  }

  ////// Helper functions
  private async getMatchingApplication(
    userProposed: boolean = true,
  ): Promise<undefined | { state: AppState; transferApp: AppInstanceInfo }> {
    const registryInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    if (!registryInfo) {
      this.log.error(`Could not find app in registry with network: ${this.connext.network.name}`);
      return undefined;
    }

    const applications = await this.connext.getAppInstances();
    const transferApp: AppInstanceInfo = applications.filter((appInfo: AppInstanceInfo) => {
      const correctProposer = userProposed
        ? appInfo.proposedByIdentifier === this.connext.publicIdentifier
        : appInfo.proposedToIdentifier === this.connext.publicIdentifier;
      return (
        appInfo.appDefinition.toLowerCase() === registryInfo.appDefinition.toLowerCase() &&
        correctProposer
      );
    })[0];
    if (!transferApp) {
      this.log.info(`Could not find any matching transfer applications`);
      return undefined;
    }

    this.log.info(`Found matching application: ${JSON.stringify(transferApp, null, 2)}`);

    const { state } = await this.connext.getAppState(transferApp.id);
    return {
      state: state as AppState,
      transferApp,
    };
  }
}
