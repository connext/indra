import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  InstallMessage,
  InstallVirtualMessage,
  Node,
  ProposeMessage,
  ProposeVirtualMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
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
      this.emitAndLog(NodeTypes.EventName.CREATE_CHANNEL, data.data);
    },
    // TODO: make cf return app instance id and app def?
    INSTALL_VIRTUAL: (data: InstallVirtualMessage): void => {
      this.emitAndLog(NodeTypes.EventName.INSTALL_VIRTUAL, data.data);
    },
    PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
      this.emitAndLog(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
    },
    UNINSTALL_VIRTUAL: (data: UninstallVirtualMessage): void => {
      this.emitAndLog(NodeTypes.EventName.UNINSTALL_VIRTUAL, data.data);
    },
    UPDATE_STATE: (data: UpdateStateMessage): void => {
      this.emitAndLog(NodeTypes.EventName.UPDATE_STATE, data.data);
    },
    DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_CONFIRMED, data);
    },
    DEPOSIT_FAILED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_FAILED, data);
    },
    COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
      this.emitAndLog(NodeTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data.data);
    },
    DEPOSIT_STARTED: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_STARTED, data);
    },
    INSTALL: (data: InstallMessage): void => {
      this.emitAndLog(NodeTypes.EventName.INSTALL, data.data);
    },
    PROPOSE_STATE: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.PROPOSE_STATE, data);
    },
    REJECT_INSTALL: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_INSTALL, data);
    },
    REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, data.data);
    },
    REJECT_STATE: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.REJECT_STATE, data);
    },
    UNINSTALL: (data: UninstallMessage): void => {
      this.emitAndLog(NodeTypes.EventName.UNINSTALL, data.data);
    },
    PROPOSE_INSTALL: (data: ProposeMessage): void => {
      this.emitAndLog(NodeTypes.EventName.PROPOSE_INSTALL, data.data);
    },
    WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, data.data);
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

  public registerCfListener = (event: NodeTypes.EventName, cb: Function): void => {
    // replace with new fn
    this.log.info(`Registering listener for ${event}`);
    // TODO: type res by obj with event as keys?
    this.cfModule.on(event, async (res: any) => {
      await cb(res);
      this.emit(event, res);
    });
  };

  public removeCfListener = (event: NodeTypes.EventName, cb: Function): boolean => {
    this.log.info(`Removing listener for ${event}`);
    try {
      this.removeListener(event, cb as any);
      return true;
    } catch (e) {
      this.log.error(
        `Error trying to remove registered listener from event: ${event}. Error: ${e.message}`,
      );
      return false;
    }
  };

  public registerDefaultCfListeners = (): void => {
    Object.entries(this.defaultCallbacks).forEach(([event, callback]) => {
      this.cfModule.on(NodeTypes.EventName[event], callback);
    });
  };

  private emitAndLog = (event: NodeTypes.EventName, data: any): void => {
    this.log.info(`Emitted ${event}`);
    this.emit(event, data);
  };
}
