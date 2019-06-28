import { EventName } from "@connext/types";
import {
  CreateChannelMessage,
  InstallVirtualMessage,
  Node,
  ProposeVirtualMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { EventEmitter } from "events";

import { Logger } from "./lib/logger";

// TODO: index of connext events only?
type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: any) => Promise<any> | void;
};
export class ConnextListener extends EventEmitter {
  private log: Logger;
  private cfModule: Node;

  // TODO: add custom parsing functions here to convert event data
  // to something more usable?
  private defaultCallbacks: CallbackStruct = {
    CREATE_CHANNEL: (data: CreateChannelMessage): void => {
      this.emitAndLog(EventName.CREATE_CHANNEL, data.data);
    },
    INSTALL_VIRTUAL: (data: InstallVirtualMessage): void => {
      this.emitAndLog(EventName.INSTALL_VIRTUAL, data.data);
    },
    PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
      this.emitAndLog(EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
    },
    UNINSTALL_VIRTUAL: (data: UninstallVirtualMessage): void => {
      this.emitAndLog(EventName.UNINSTALL_VIRTUAL, data.data);
    },
    UPDATE_STATE: (data: UpdateStateMessage): void => {
      this.emitAndLog(EventName.UPDATE_STATE, data.data);
    },
    DEPOSIT_CONFIRMED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_CONFIRMED, data);
    },
    DEPOSIT_FAILED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_FAILED, data);
    },
    COUNTER_DEPOSIT_CONFIRMED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data);
    },
    DEPOSIT_STARTED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_STARTED, data);
    },
    INSTALL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.INSTALL, data);
    },
    PROPOSE_STATE: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.PROPOSE_STATE, data);
    },
    REJECT_INSTALL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_INSTALL, data);
    },
    REJECT_INSTALL_VIRTUAL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, data);
    },
    REJECT_STATE: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_STATE, data);
    },
    UNINSTALL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.UNINSTALL, data);
    },
    PROPOSE_INSTALL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.PROPOSE_INSTALL, data);
    },
    WITHDRAWAL_CONFIRMED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, data);
    },
    WITHDRAWAL_FAILED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAWAL_FAILED, data);
    },
    WITHDRAWAL_STARTED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAWAL_STARTED, data);
    },
    WITHDRAW_EVENT: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAW_EVENT, data);
    },
    PROTOCOL_MESSAGE_EVENT: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
    },
  };

  constructor(cfModule: Node, logLevel: number) {
    super();
    this.cfModule = cfModule;
    this.log = new Logger("ConnextListener", logLevel);
  }

  public registerCfListener(
    event: NodeTypes.EventName,
    cb: (data: any) => Promise<void> | void,
  ): void {
    // replace with new fn
    // TODO: type res by obj with event as keys?
    this.cfModule.on(event, async (res: any) => {
      await cb(res);
      this.emit(event, res);
    });
  }

  public removeCfListener(
    event: NodeTypes.EventName,
    cb: (data: any) => Promise<void> | void,
  ): boolean {
    try {
      this.removeListener(event, cb);
      return true;
    } catch (e) {
      this.log.error(
        `Error trying to remove registered listener from event: ${event}. Error: ${e.message}`,
      );
      return false;
    }
  }

  public registerDefaultCfListeners(): void {
    Object.entries(this.defaultCallbacks).forEach(([event, callback]) => {
      this.cfModule.on(event, callback);
    });
  }

  private emitAndLog(event: NodeTypes.EventName | EventName, data: any): void {
    this.log.info(`Emitted ${event} with data: ${JSON.stringify(data, null, 2)}`);
    this.emit(event, data);
  }
}
