import { RegisteredAppDetails, SupportedApplications } from "@connext/types";
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
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { EventEmitter } from "events";

import { ConnextInternal } from "./connext";
import { Logger } from "./lib/logger";
import { appProposalValidation } from "./validation/appProposals";

// TODO: index of connext events only?
type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: any) => Promise<any> | void;
};

export class ConnextListener extends EventEmitter {
  private log: Logger;
  private cfModule: Node;
  private connext: ConnextInternal;

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
    PROPOSE_INSTALL_VIRTUAL: async (data: ProposeVirtualMessage): Promise<void> => {
      // validate and automatically install for the known and supported
      // applications
      // if the from is us, ignore
      this.emitAndLog(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
      if (data.from === this.cfModule.publicIdentifier) {
        return;
      }
      // check based on supported applications
      const appInfo = (await this.connext.getAppInstanceDetails(data.data.appInstanceId))
        .appInstance;
      const filtered = this.connext.appRegistry
        .map((app: RegisteredAppDetails) => {
          return this.matchAppInstance(appInfo, app);
        })
        // TODO: improve typing?
        .filter((a: any) => a !== undefined);
      if (!filtered || filtered.length === 0) {
        this.log.info(
          `Proposed app not in registered applications. App: ${JSON.stringify(appInfo, null, 2)}`,
        );
        return;
      }
      if (filtered.length > 1) {
        // TODO: throw error here?
        this.log.error(
          `Proposed app matched multiple registered applications. App: ${JSON.stringify(
            appInfo,
            null,
            2,
          )}`,
        );
        return;
      }
      // matched app, take appropriate default actions
      await this.verifyAndInstallKnownApp(appInfo, filtered[0]);
      // FIXME: request additional collateral
      // await this.connext.requestCollateral();
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
      this.log.info(
        `deposit for ${data.data.value.toString()} started. hash: ${data.data.transactionHash}`,
      );
      this.emitAndLog(NodeTypes.EventName.DEPOSIT_STARTED, data);
    },
    INSTALL: (data: InstallMessage): void => {
      this.emitAndLog(NodeTypes.EventName.INSTALL, data.data);
    },
    PROPOSE_STATE: (data: any): void => {
      // TODO: need to validate all apps here as well?
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
      this.log.info(
        `withdrawal for ${data.data.value.toString()} started. hash: ${data.data.transactionHash}`,
      );
      this.emitAndLog(NodeTypes.EventName.WITHDRAWAL_STARTED, data);
    },
    WITHDRAW_EVENT: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.WITHDRAW_EVENT, data);
    },
    PROTOCOL_MESSAGE_EVENT: (data: any): void => {
      this.emitAndLog(NodeTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
    },
  };

  constructor(cfModule: Node, connext: ConnextInternal) {
    super();
    this.cfModule = cfModule;
    this.connext = connext;
    this.log = new Logger("ConnextListener", connext.opts.logLevel);
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

  private matchAppInstance = (
    appInstance: AppInstanceInfo,
    app: RegisteredAppDetails,
  ): RegisteredAppDetails | undefined => {
    let foundMatch = true;
    Object.entries(appInstance).forEach(([key, value]) => {
      if (foundMatch && app[key]) {
        // NOTE: will not work if there are big number
        // types in RegisteredAppDetails fields
        foundMatch = app[key] === value;
      }
    });
    return foundMatch ? app : undefined;
  };

  private verifyAndInstallKnownApp = async (
    appInstance: AppInstanceInfo,
    matchedApp: RegisteredAppDetails,
  ): Promise<void> => {
    // sanity check that the matched app actually matches
    const isThisChill = this.matchAppInstance(appInstance, matchedApp);
    if (!isThisChill) {
      throw new Error("Matched app instance doesnt actually match. This should never happen.");
    }

    const invalidProposal = await appProposalValidation[matchedApp.name](
      appInstance,
      matchedApp,
      this.connext,
    );
    if (invalidProposal) {
      // reject app installation
      return;
    }

    // proposal is valid, automatically install known app
    await this.connext.installVirtualApp(appInstance.identityHash);
    return;
  };
}
