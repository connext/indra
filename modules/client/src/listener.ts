import { RegisteredAppDetails, SupportedApplications } from "@connext/types";
import { AppInstanceInfo, Node as CFCoreTypes } from "@counterfactual/types";
import EthCrypto from "eth-crypto";
import { bigNumberify, formatParamType } from "ethers/utils";
import { fromMnemonic } from "ethers/utils/hdnode";
import { EventEmitter } from "events";

import { ChannelRouter } from "./channelRouter";
import { ConnextClient } from "./connext";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  InstallMessage,
  InstallVirtualMessage,
  ProposeMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "./lib/cfCore";
import { Logger } from "./lib/logger";
import { replaceBN } from "./lib/utils";
import { appProposalValidation } from "./validation/appProposals";

// TODO: index of connext events only?
type CallbackStruct = {
  [index in keyof typeof CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

export class ConnextListener extends EventEmitter {
  private log: Logger;
  private channelRouter: ChannelRouter;
  private connext: ConnextClient;

  // TODO: add custom parsing functions here to convert event data
  // to something more usable?
  private defaultCallbacks: CallbackStruct = {
    COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data.data);
    },
    CREATE_CHANNEL: (data: CreateChannelMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.CREATE_CHANNEL, data.data);
    },
    DEPOSIT_CONFIRMED: async (data: DepositConfirmationMessage): Promise<void> => {
      this.emitAndLog(CFCoreTypes.EventName.DEPOSIT_CONFIRMED, data);
    },
    DEPOSIT_FAILED: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.DEPOSIT_FAILED, data);
    },
    DEPOSIT_STARTED: (data: any): void => {
      this.log.info(`deposit for ${data.value.toString()} started. hash: ${data.txHash}`);
      this.emitAndLog(CFCoreTypes.EventName.DEPOSIT_STARTED, data);
    },
    INSTALL: (data: InstallMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.INSTALL, data.data);
    },
    // TODO: make cf return app instance id and app def?
    INSTALL_VIRTUAL: (data: InstallVirtualMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.INSTALL_VIRTUAL, data.data);
    },
    PROPOSE_INSTALL: async (data: ProposeMessage): Promise<void> => {
      // validate and automatically install for the known and supported
      // applications
      this.emitAndLog(CFCoreTypes.EventName.PROPOSE_INSTALL, data.data);
      // check if message is from us, return if so
      // FIXME: type of ProposeMessage should extend CFCore.NodeMessage, which
      // has a from field, but ProposeMessage does not
      if ((data as any).from === this.connext.publicIdentifier) {
        this.log.debug(
          `Received proposal from our own node, doing nothing: ${JSON.stringify(data)}`,
        );
        return;
      }
      // check based on supported applications
      // matched app, take appropriate default actions
      const matchedResult = await this.matchAppInstance(data);
      if (!matchedResult) {
        this.log.warn(`No matched app, doing nothing, ${JSON.stringify(data)}`);
        return;
      }
      if (matchedResult.matchedApp.name === "SimpleTransferApp") {
        this.log.debug(
          `Caught propose install for what should always be a virtual app. CF should also emit a virtual app install event, so let this callback handle and verify. Will need to refactor soon!`,
        );
        return;
      }
      // matched app, take appropriate default actions
      const { appInfo, matchedApp } = matchedResult;
      await this.verifyAndInstallKnownApp(appInfo, matchedApp, false);
      return;
    },
    PROPOSE_INSTALL_VIRTUAL: async (data: ProposeMessage): Promise<void> => {
      // validate and automatically install for the known and supported
      // applications
      this.emitAndLog(CFCoreTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data.data);
      // if the from is us, ignore
      // FIXME: type of ProposeVirtualMessage should extend Node.NodeMessage,
      // which has a from field, but ProposeVirtualMessage does not
      if ((data as any).from === this.connext.publicIdentifier) {
        return;
      }
      // check based on supported applications
      // matched app, take appropriate default actions
      const matchedResult = await this.matchAppInstance(data);
      if (!matchedResult) {
        return;
      }
      if (matchedResult.matchedApp.name !== "SimpleTransferApp") {
        this.log.debug(
          `Caught propose install virtual for what should always be a regular app. CF should also emit a virtual app install event, so let this callback handle and verify. Will need to refactor soon!`,
        );
        return;
      }
      // matched app, take appropriate default actions
      const { appInfo, matchedApp } = matchedResult;
      await this.verifyAndInstallKnownApp(appInfo, matchedApp);
      return;
    },
    PROPOSE_STATE: (data: any): void => {
      // TODO: validate the proposed state
      // TODO: are we using this flow in any of the known/supported
      // applications
      this.emitAndLog(CFCoreTypes.EventName.PROPOSE_STATE, data);
    },
    PROTOCOL_MESSAGE_EVENT: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
    },
    REJECT_INSTALL: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.REJECT_INSTALL, data);
    },
    REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, data.data);
    },
    REJECT_STATE: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.REJECT_STATE, data);
    },
    UNINSTALL: (data: UninstallMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.UNINSTALL, data.data);
    },
    UNINSTALL_VIRTUAL: (data: UninstallVirtualMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.UNINSTALL_VIRTUAL, data.data);
    },
    UPDATE_STATE: (data: UpdateStateMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.UPDATE_STATE, data.data);
    },
    WITHDRAW_EVENT: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.WITHDRAW_EVENT, data);
    },
    WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
      this.emitAndLog(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED, data.data);
    },
    WITHDRAWAL_FAILED: (data: any): void => {
      this.emitAndLog(CFCoreTypes.EventName.WITHDRAWAL_FAILED, data);
    },
    WITHDRAWAL_STARTED: (data: any): void => {
      this.log.info(`withdrawal for ${data.value.toString()} started. hash: ${data.txHash}`);
      this.emitAndLog(CFCoreTypes.EventName.WITHDRAWAL_STARTED, data);
    },
  };

  constructor(channelRouter: ChannelRouter, connext: ConnextClient) {
    super();
    this.channelRouter = channelRouter;
    this.connext = connext;
    this.log = new Logger("ConnextListener", connext.log.logLevel);
  }

  public register = async (): Promise<void> => {
    await this.registerAvailabilitySubscription();
    this.registerDefaultListeners();
    await this.registerLinkedTransferSubscription();
    return;
  };

  public registerCfListener = (event: CFCoreTypes.EventName, cb: Function): void => {
    // replace with new fn
    this.log.debug(`Registering listener for ${event}`);
    this.channelRouter.on(
      event,
      async (res: any): Promise<void> => {
        await cb(res);
        this.emit(event, res);
      },
    );
  };

  public removeCfListener = (event: CFCoreTypes.EventName, cb: Function): boolean => {
    this.log.debug(`Removing listener for ${event}`);
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

  public registerDefaultListeners = (): void => {
    Object.entries(this.defaultCallbacks).forEach(([event, callback]: any): any => {
      this.channelRouter.on(CFCoreTypes.EventName[event], callback);
    });

    this.channelRouter.on(CFCoreTypes.RpcMethodName.INSTALL, (data: any): any => {
      const appInstance = data.result.result.appInstance;
      this.log.debug(
        `Emitting CFCoreTypes.RpcMethodName.INSTALL event: ${JSON.stringify(appInstance)}`,
      );
      this.connext.messaging.publish(
        `indra.client.${this.connext.publicIdentifier}.install.${appInstance.identityHash}`,
        JSON.stringify(appInstance),
      );
    });

    this.channelRouter.on(CFCoreTypes.RpcMethodName.UNINSTALL, (data: any): any => {
      const result = data.result.result;
      this.log.debug(
        `Emitting CFCoreTypes.RpcMethodName.UNINSTALL event: ${JSON.stringify(result)}`,
      );
      this.connext.messaging.publish(
        `indra.client.${this.connext.publicIdentifier}.uninstall.${result.appInstanceId}`,
        JSON.stringify(result),
      );
    });
  };

  private emitAndLog = (event: CFCoreTypes.EventName, data: any): void => {
    this.log.debug(`Emitted ${event} with data ${JSON.stringify(data)} at ${Date.now()}`);
    this.emit(event, data);
  };

  private matchAppInstance = async (
    data: ProposeMessage,
  ): Promise<{ matchedApp: RegisteredAppDetails; appInfo: AppInstanceInfo } | undefined> => {
    const filteredApps = this.connext.appRegistry.filter((app: RegisteredAppDetails): boolean => {
      return app.appDefinitionAddress === data.data.params.appDefinition;
    });

    if (!filteredApps || filteredApps.length === 0) {
      this.log.info(
        `Proposed app not in registered applications. App: ${JSON.stringify(data, replaceBN, 2)}`,
      );
      return undefined;
    }

    if (filteredApps.length > 1) {
      // TODO: throw error here?
      this.log.error(
        `Proposed app matched ${
          filteredApps.length
        } registered applications by definition address. App: ${JSON.stringify(
          data,
          replaceBN,
          2,
        )}`,
      );
      return undefined;
    }
    // matched app, take appropriate default actions
    return {
      appInfo: {
        ...data.data.params,
        identityHash: data.data.appInstanceId,
        initiatorDeposit: bigNumberify(data.data.params.initiatorDeposit),
        initiatorDepositTokenAddress: data.data.params.initiatorDepositTokenAddress,
        proposedByIdentifier: data.from,
        responderDeposit: bigNumberify(data.data.params.responderDeposit),
        responderDepositTokenAddress: data.data.params.responderDepositTokenAddress,
      },
      matchedApp: filteredApps[0],
    };
  };

  private verifyAndInstallKnownApp = async (
    appInstance: AppInstanceInfo,
    matchedApp: RegisteredAppDetails,
    isVirtual: boolean = true,
  ): Promise<void> => {
    const invalidProposal = await appProposalValidation[matchedApp.name](
      appInstance,
      matchedApp,
      isVirtual,
      this.connext,
    );

    if (invalidProposal) {
      // reject app installation
      this.log.error(`Proposed app is invalid. ${invalidProposal}`);
      await this.connext.rejectInstallApp(appInstance.identityHash);
      return;
    }

    // proposal is valid, automatically install known app, but
    // do not ever automatically install swap app since theres no
    // way to validate the exchange in app against the rate input
    // to controller
    // this means the hub can only install apps, and cannot propose a swap
    // and there cant easily be an automatic install swap app between users
    if (matchedApp.name === SupportedApplications.SimpleTwoPartySwapApp) {
      return;
    }

    if (matchedApp.name === SupportedApplications.SimpleTransferApp) {
      // request collateral in token of the app
      await this.connext.requestCollateral(appInstance.initiatorDepositTokenAddress);
    }
    this.log.debug(`Proposal for app install successful, attempting install now...`);
    let res: CFCoreTypes.InstallResult;
    if (isVirtual) {
      res = await this.connext.installVirtualApp(appInstance.identityHash);
    } else {
      res = await this.connext.installApp(appInstance.identityHash);
    }
    this.log.debug(`App installed, res: ${JSON.stringify(res, replaceBN, 2)}`);
    return;
  };

  private registerAvailabilitySubscription = async (): Promise<void> => {
    const subject = `online.${this.connext.publicIdentifier}`;
    await this.connext.messaging.subscribe(
      subject,
      async (msg: any): Promise<any> => {
        if (!msg.reply) {
          this.log.warn(`No reply found for msg: ${msg}`);
          return;
        }

        const response = true;
        this.connext.messaging.publish(msg.reply, {
          err: null,
          response,
        });
      },
    );
    this.log.debug(`Connected message pattern "${subject}"`);
  };

  private registerLinkedTransferSubscription = async (): Promise<void> => {
    const subject = `transfer.send-async.${this.connext.publicIdentifier}`;
    await this.connext.messaging.subscribe(
      subject,
      async (data: any): Promise<any> => {
        this.log.info(`Received message for subscription: ${JSON.stringify(data)}`);
        const { encryptedPreImage, paymentId } = data;
        await this.connext.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
      },
    );
  };
}
