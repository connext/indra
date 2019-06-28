import {
  AppRegistry,
  BigNumber,
  ChannelState,
  EventName,
  TransferParameters,
} from "@connext/types";
import {
  jsonRpcDeserialize,
  ProposeVirtualMessage,
  UpdateStateMessage,
} from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";

import { delay } from "../lib/utils";

import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  private appInstanceId: undefined | string;
  private successfullyInstalled: boolean = false;

  public async transfer(params: TransferParameters): Promise<ChannelState> {
    this.log.info("Transfer called, yay!");

    if (!params.recipient.startsWith("xpub")) {
      throw new Error("Recipient must be xpub");
    }

    // register listeners
    this.listener.registerCfListener(
      EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );
    this.listener.registerCfListener(EventName.UPDATE_STATE, this.updateStateCallback);

    // get app definition from constants
    // TODO: this should come from a db on the node
    const appInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    // TODO: check if recipient has a channel with the hub

    // make sure the app isnt already installed
    const transferApp: AppInstanceInfo = (await this.connext.getAppInstances()).filter(
      (info: AppInstanceInfo) => {
        return info.appDefinition.toLowerCase() === appInfo.appDefinition.toLowerCase();
      },
    )[0];

    if (transferApp) {
      this.log.info(
        `Found already installed transfer app: ${JSON.stringify(transferApp, null, 2)}`,
      );
      // set app instance id
      this.appInstanceId = transferApp[0].id;
    } else {
      // install the transfer application
      // TODO: update if it is token unidirectional
      await this.connext.proposeInstallVirtualApp(
        "EthUnidirectionalTransferApp",
        new BigNumber(params.amount),
        params.recipient, // must be xpub
      );
    }

    // take action
    // wait until app is installed successfully
    let retry = 0;
    while (!this.successfullyInstalled && retry < 5) {
      this.log.info(
        "App not successfully installed yet, waiting 1 more second before trying to send...",
      );
      retry = retry + 1;
      await delay(1000);
    }

    if (retry >= 5 && !this.successfullyInstalled) {
      throw new Error("Could not successfully install virtual app after waiting 5s");
    }

    await this.connext.takeAction(this.appInstanceId, {
      finalize: false,
      transferAmount: new BigNumber(params.amount),
    });

    // uninstall
    await this.connext.uninstallVirtualApp(this.appInstanceId);

    // remove listeners
    // TODO: should this be done in an uninstall listener?
    this.listener.removeCfListener(
      EventName.PROPOSE_INSTALL_VIRTUAL,
      this.proposeInstallVirtualCallback,
    );
    this.listener.removeCfListener(EventName.UPDATE_STATE, this.updateStateCallback);

    return {} as ChannelState;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS
  private async proposeInstallVirtualCallback(data: ProposeVirtualMessage): Promise<void> {
    this.appInstanceId = data.data.appInstanceId;
    const intermediaries = data.data.params.intermediaries;

    console.log(
      "********** MADE IT INTO THE PROPOSE INSTALL VIRTUAL CALLBACK DEFINED IN TRANSFER CONTROLLER",
    );

    try {
      const installVirtualResponse = await this.cfModule.router.dispatch(
        jsonRpcDeserialize({
          id: Date.now(),
          jsonrpc: "2.0",
          method: NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
          params: {
            appInstanceId: this.appInstanceId,
            intermediaries,
          } as NodeTypes.InstallVirtualParams,
        }),
      );
      this.log.info(
        `installVirtualResponse result:
        ${installVirtualResponse.result as NodeTypes.InstallVirtualResult}`,
      );
      this.successfullyInstalled = true;
    } catch (e) {
      this.log.error("Node call to install virtual app failed.");
      this.log.error(JSON.stringify(e, null, 2));
    }
  }

  private updateStateCallback(data: UpdateStateMessage): void {
    console.log("********** MADE IT INTO THE UPDATE STATE CALLBACK DEFINED IN TRANSFER CONTROLLER");
    if ((data.data as NodeTypes.UpdateStateEventData).appInstanceId === this.appInstanceId) {
      this.log.info(`updateEventData: ${JSON.stringify(data.data)}`);
      this.listener.emit(EventName.UPDATE_STATE, data.data);
    }
  }
}
