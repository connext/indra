import { EventName } from "@connext/types";
import {
  CreateChannelMessage,
  InstallVirtualMessage,
  jsonRpcDeserialize,
  Node,
  ProposeVirtualMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { EventEmitter } from "events";

import { Logger } from "./lib/logger";

export class ConnextListener extends EventEmitter {
  private log: Logger;
  private cfModule: Node;

  constructor(cfModule: Node, logLevel: number) {
    super();
    this.cfModule = cfModule;
    this.log = new Logger("ConnextListener", logLevel);
  }

  // TODO: make more generic
  public registerCfListeners(): void {
    this.cfModule.on(NodeTypes.EventName.CREATE_CHANNEL, (res: CreateChannelMessage) => {
      this.emit(EventName.CREATE_CHANNEL, res);
    });

    // connect virtual app install
    this.cfModule.on(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      async (data: ProposeVirtualMessage): Promise<any> => {
        const appInstanceId = data.data.appInstanceId;
        const intermediaries = data.data.params.intermediaries;
        // TODO: add connext type for result
        this.emit(EventName.PROPOSE_INSTALL_VIRTUAL, JSON.stringify(data.data, null, 2));

        // install virtual app if requested to
        // TODO: should probably validate this against the node's AppRegistry
        // TODO: should not happen in the low level event listeners, happen at
        // controller level
        try {
          const installVirtualResponse = await this.cfModule.router.dispatch(
            jsonRpcDeserialize({
              id: Date.now(),
              jsonrpc: "2.0",
              method: NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
              params: { appInstanceId, intermediaries } as NodeTypes.InstallVirtualParams,
            }),
          );
          this.log.info(
            `installVirtualResponse result:
            ${installVirtualResponse.result as NodeTypes.InstallVirtualResult}`,
          );
          // TODO: probably should do something else here?
          this.cfModule.on(
            NodeTypes.EventName.UPDATE_STATE,
            async (updateEventData: any): Promise<void> => {
              if (
                (updateEventData.data as NodeTypes.UpdateStateEventData).appInstanceId ===
                appInstanceId
              ) {
                this.log.info(`updateEventData: ${JSON.stringify(updateEventData.data)}`);
                this.emit(EventName.UPDATE_STATE, updateEventData.data);
              }
            },
          );
        } catch (e) {
          console.error("Node call to install virtual app failed.");
          console.error(e);
        }
      },
    );

    // pass through events
    this.cfModule.on(
      NodeTypes.EventName.INSTALL_VIRTUAL,
      async (installVirtualData: InstallVirtualMessage): Promise<any> => {
        this.log.info(`installVirtualData: ${JSON.stringify(installVirtualData.data)}`);
        this.emit(EventName.INSTALL_VIRTUAL, installVirtualData.data);
      },
    );

    this.cfModule.on(
      NodeTypes.EventName.UPDATE_STATE,
      async (updateStateData: UpdateStateMessage): Promise<any> => {
        this.log.info(`updateStateData: ${JSON.stringify(updateStateData.data)}`);
        this.emit(EventName.UPDATE_STATE, updateStateData.data);
      },
    );

    this.cfModule.on(
      NodeTypes.EventName.UNINSTALL_VIRTUAL,
      async (uninstallMsg: UninstallVirtualMessage) => {
        this.log.info(`uninstallMsg: ${JSON.stringify(uninstallMsg.data)}`);
        this.emit(EventName.UNINSTALL_VIRTUAL, uninstallMsg.data);
      },
    );

    console.info(`CF Node handlers connected`);
  }
}
