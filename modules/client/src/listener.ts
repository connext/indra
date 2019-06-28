import { EventName } from "@connext/types";
import {
  CreateChannelMessage,
  InstallVirtualMessage,
  jsonRpcDeserialize,
  Node,
  ProposeVirtualMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { EventEmitter } from "events";

import { Logger } from "./lib/logger";

type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: NodeTypes.EventData) => Promise<any> | void;
};
export class ConnextListener extends EventEmitter {
  private log: Logger;
  private cfModule: Node;
  private registeredCallbacks: Partial<CallbackStruct> = {};

  // TODO: should have some constant "event parsing" functions
  // in an obj keyed by the cf module event names
  // that way we can emit different payloads based on the
  // cf events

  // TODO: finish out these callbacks
  private defaultCallbacks: CallbackStruct = {
    PROPOSE_INSTALL: (data: NodeTypes.EventData): void => {
      this.emit(EventName.PROPOSE_INSTALL_VIRTUAL, data);
    },
    // @ts-ignore
    CREATE_CHANNEL: (data: CreateChannelMessage): void => {
      this.emit(EventName.CREATE_CHANNEL, data);
    },
  };

  constructor(cfModule: Node, logLevel: number) {
    super();
    this.cfModule = cfModule;
    this.log = new Logger("ConnextListener", logLevel);
  }

  // @rahul --> thinking its best to have default callbacks, and easy ways for
  // the controllers to update what the handler is for their purposes
  // not sure if this is the best way to do this though...

  // also, if i expose the event listener here do you know the best way
  // to emit events so users can listen like connext.on() while still
  // keeping all the listener bits modular? could have an event emitter
  // at the client level as well but would rather not
  public registerCfListener(event: NodeTypes.EventName, cb: (data: any) => Promise<void>): void {
    // remove existing listener
    // check if its previously registered with a callbacl
    if (this.registeredCallbacks[event]) {
      this.removeListener(event, this.registeredCallbacks[event]);
    } else {
      // remove the default
      this.removeListener(event, this.defaultCallbacks[event]);
    }

    // replace with new fn
    // TODO: type res by obj with event as keys
    this.cfModule.on(event, async (res: any) => {
      await cb(res);
      this.emit(event, res);
    });

    // save reference to event to remove later
    this.registeredCallbacks[event] = cb;
  }

  // TODO: make more generic
  public registerCfListeners(): void {
    this.cfModule.on(NodeTypes.EventName.CREATE_CHANNEL, (res: CreateChannelMessage) => {
      this.emit(EventName.CREATE_CHANNEL, res);
    });

    this.cfModule.on(
      NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL,
      async (data: ProposeVirtualMessage) => {
        this.log.info(`caught proposeInstall data: ${JSON.stringify(data.data, null, 2)}`);
        this.emit(EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
      },
    );

    this.cfModule.on(NodeTypes.EventName.INSTALL_VIRTUAL, (data: InstallVirtualMessage) => {
      this.log.info(`caught installVirtual data: ${JSON.stringify(data.data)}`);
      this.emit(EventName.INSTALL_VIRTUAL, data.data);
    });

    this.cfModule.on(NodeTypes.EventName.UPDATE_STATE, (updateStateData: UpdateStateMessage) => {
      this.log.info(`caught updateStateData: ${JSON.stringify(updateStateData.data)}`);
      this.emit(EventName.UPDATE_STATE, updateStateData.data);
    });

    this.cfModule.on(
      NodeTypes.EventName.UNINSTALL_VIRTUAL,
      (uninstallMsg: UninstallVirtualMessage) => {
        this.log.info(`caught uninstallVirtualMsg: ${JSON.stringify(uninstallMsg.data)}`);
        this.emit(EventName.UNINSTALL_VIRTUAL, uninstallMsg.data);
      },
    );

    this.cfModule.on(NodeTypes.EventName.WITHDRAWAL_STARTED, (withdrawal: WithdrawMessage) => {
      this.log.info(`caught withdrawalMsg: ${JSON.stringify(withdrawal)}`);
      this.emit(EventName.WITHDRAWAL, withdrawal);
    });

    this.log.info(`CF Node handlers connected`);
  }
}
