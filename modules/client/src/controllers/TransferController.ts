import { AppRegistry, BigNumber, ChannelState, TransferParameters } from "@connext/types";
import { AppInstanceInfo } from "@counterfactual/types";

import { AbstractController } from "./AbstractController";

export class TransferController extends AbstractController {
  public async transfer(params: TransferParameters): Promise<ChannelState> {
    this.log.info("Transfer called, yay!");

    if (!params.recipient.startsWith("xpub")) {
      throw new Error("Recipient must be xpub");
    }

    // get app definition from constants
    // TODO: is there a way to make this more robust?
    const appInfo = AppRegistry[this.connext.network.name].EthUnidirectionalTransferApp;

    // TODO: check if recipient has a channel with the hub

    // make sure the app isnt already installed
    const transferApp = (await this.connext.getAppInstances()).filter((info: AppInstanceInfo) => {
      return info.appDefinition.toLowerCase() === appInfo.appDefinition.toLowerCase();
    });

    if (transferApp) {
      this.log.info(
        `Found already installed transfer app: ${JSON.stringify(transferApp, null, 2)}`,
      );
    } else {
      // install the transfer application
      // TODO: update if it is token unidirectional
      await this.connext.installVirtualApp(
        "EthUnidirectionalTransferApp",
        new BigNumber(params.amount),
        params.recipient, // must be xpub
      );
    }

    // take action

    // uninstall

    return {} as ChannelState;
  }
}
