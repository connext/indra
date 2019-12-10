import { bigNumberify } from "ethers/utils";
import { EventEmitter } from "events";

import { ChannelRouter } from "./channelRouter";
import { ConnextClient } from "./connext";
import { Logger, stringify } from "./lib";
import {
  CFCoreTypes,
  CreateChannelMessage,
  DefaultApp,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  InstallMessage,
  InstallVirtualMessage,
  NodeMessageWrappedProtocolMessage,
  ProposeMessage,
  RejectInstallVirtualMessage,
  RejectProposalMessage,
  SupportedApplications,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "./types";
import { appProposalValidation } from "./validation/appProposals";

// TODO: index of connext events only?
type CallbackStruct = {
  [index in CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

export class ConnextListener extends EventEmitter {
  private log: Logger;
  private channelRouter: ChannelRouter;
  private connext: ConnextClient;

  // TODO: add custom parsing functions here to convert event data
  // to something more usable?
  private defaultCallbacks: CallbackStruct = {
    CREATE_CHANNEL_EVENT: (msg: CreateChannelMessage): void => {
      this.emitAndLog("CREATE_CHANNEL_EVENT", msg.data);
    },
    DEPOSIT_CONFIRMED_EVENT: async (msg: DepositConfirmationMessage): Promise<void> => {
      this.emitAndLog("DEPOSIT_CONFIRMED_EVENT", msg.data);
    },
    DEPOSIT_FAILED_EVENT: (msg: DepositFailedMessage): void => {
      this.emitAndLog("DEPOSIT_FAILED_EVENT", msg.data);
    },
    DEPOSIT_STARTED_EVENT: (msg: DepositStartedMessage): void => {
      const { value, txHash } = msg.data;
      this.log.info(`deposit for ${value.toString()} started. hash: ${txHash}`);
      this.emitAndLog("DEPOSIT_STARTED_EVENT", msg.data);
    },
    INSTALL_EVENT: (msg: InstallMessage): void => {
      this.emitAndLog("INSTALL_EVENT", msg.data);
    },
    // TODO: make cf return app instance id and app def?
    INSTALL_VIRTUAL_EVENT: (msg: InstallVirtualMessage): void => {
      this.emitAndLog("INSTALL_VIRTUAL_EVENT", msg.data);
    },
    PROPOSE_INSTALL_EVENT: async (msg: ProposeMessage): Promise<void> => {
      // validate and automatically install for the known and supported
      // applications
      this.emitAndLog("PROPOSE_INSTALL_EVENT", msg.data);
      // check based on supported applications
      // matched app, take appropriate default actions
      const matchedResult = await this.matchAppInstance(msg);
      if (!matchedResult) {
        this.log.warn(`No matched app, doing nothing, ${stringify(msg)}`);
        return;
      }
      const {
        data: { params },
        from,
      } = msg;
      // return if its from us
      if (from === this.connext.publicIdentifier) {
        this.log.info(`Received proposal from our own node, doing nothing: ${stringify(msg)}`);
        return;
      }
      // matched app, take appropriate default actions
      const { matchedApp } = matchedResult;
      await this.verifyAndInstallKnownApp(msg, matchedApp);
      // only publish for coin balance refund app
      const coinBalanceDef = this.connext.appRegistry.filter(
        (app: DefaultApp) => app.name === SupportedApplications.CoinBalanceRefundApp,
      )[0];
      if (params.appDefinition !== coinBalanceDef.appDefinitionAddress) {
        this.log.info(`not sending propose message, not the coinbalance refund app`);
        return;
      }
      this.log.info(
        `Sending acceptance message to: indra.client.${this.connext.publicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
      );
      await this.connext.messaging.publish(
        `indra.client.${this.connext.publicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
        stringify(params),
      );
      return;
    },
    PROTOCOL_MESSAGE_EVENT: (msg: NodeMessageWrappedProtocolMessage): void => {
      this.emitAndLog("PROTOCOL_MESSAGE_EVENT", msg.data);
    },
    REJECT_INSTALL_EVENT: (msg: RejectProposalMessage): void => {
      this.emitAndLog("REJECT_INSTALL_EVENT", msg.data);
    },
    UNINSTALL_EVENT: (msg: UninstallMessage): void => {
      this.emitAndLog("UNINSTALL_EVENT", msg.data);
    },
    UNINSTALL_VIRTUAL_EVENT: (msg: UninstallVirtualMessage): void => {
      this.emitAndLog("UNINSTALL_VIRTUAL_EVENT", msg.data);
    },
    UPDATE_STATE_EVENT: (msg: UpdateStateMessage): void => {
      this.emitAndLog("UPDATE_STATE_EVENT", msg.data);
    },
    WITHDRAWAL_CONFIRMED_EVENT: (msg: WithdrawConfirmationMessage): void => {
      this.emitAndLog("WITHDRAWAL_CONFIRMED_EVENT", msg.data);
    },
    WITHDRAWAL_FAILED_EVENT: (msg: WithdrawFailedMessage): void => {
      this.emitAndLog("WITHDRAWAL_FAILED_EVENT", msg.data);
    },
    WITHDRAWAL_STARTED_EVENT: (msg: WithdrawStartedMessage): void => {
      const {
        params: { amount },
        txHash,
      } = msg.data;
      this.log.info(`withdrawal for ${amount.toString()} started. hash: ${txHash}`);
      this.emitAndLog("WITHDRAWAL_STARTED_EVENT", msg.data);
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
      this.channelRouter.on(CFCoreTypes.EventNames[event], callback);
    });

    this.channelRouter.on(
      CFCoreTypes.RpcMethodName.INSTALL,
      async (msg: any): Promise<void> => {
        const {
          result: {
            result: { appInstance },
          },
        } = msg;
        await this.connext.messaging.publish(
          `indra.client.${this.connext.publicIdentifier}.install.${appInstance.identityHash}`,
          stringify(appInstance),
        );
      },
    );

    this.channelRouter.on(CFCoreTypes.RpcMethodName.UNINSTALL, (data: any): any => {
      const result = data.result.result;
      this.log.debug(`Emitting CFCoreTypes.RpcMethodName.UNINSTALL event: ${stringify(result)}`);
      this.connext.messaging.publish(
        `indra.client.${this.connext.publicIdentifier}.uninstall.${result.appInstanceId}`,
        stringify(result),
      );
    });
  };

  private emitAndLog = (event: CFCoreTypes.EventName, data: any): void => {
    const protocol =
      event === CFCoreTypes.EventNames.PROTOCOL_MESSAGE_EVENT
        ? data.data
          ? data.data.protocol
          : data.protocol
        : "";
    this.log.info(`Recieved ${event}${protocol ? ` for ${protocol} protocol` : ""}`);
    this.log.debug(`Emitted ${event} with data ${stringify(data)} at ${Date.now()}`);
    this.emit(event, data);
  };

  private matchAppInstance = async (
    msg: ProposeMessage,
  ): Promise<
    | undefined
    | {
        matchedApp: DefaultApp;
        proposeParams: CFCoreTypes.ProposeInstallParams;
        appInstanceId: string;
      }
  > => {
    const filteredApps = this.connext.appRegistry.filter((app: DefaultApp): boolean => {
      return app.appDefinitionAddress === msg.data.params.appDefinition;
    });

    if (!filteredApps || filteredApps.length === 0) {
      this.log.info(`Proposed app not in registered applications. App: ${stringify(msg)}`);
      return undefined;
    }

    if (filteredApps.length > 1) {
      // TODO: throw error here?
      this.log.error(
        `Proposed app matched ${
          filteredApps.length
        } registered applications by definition address. App: ${stringify(msg)}`,
      );
      return undefined;
    }
    const { params, appInstanceId } = msg.data;
    const { initiatorDeposit, responderDeposit } = params;
    // matched app, take appropriate default actions
    return {
      appInstanceId,
      matchedApp: filteredApps[0],
      proposeParams: {
        ...params,
        initiatorDeposit: bigNumberify(initiatorDeposit),
        responderDeposit: bigNumberify(responderDeposit),
      },
    };
  };

  private verifyAndInstallKnownApp = async (
    msg: ProposeMessage,
    matchedApp: DefaultApp,
  ): Promise<void> => {
    const {
      data: { params, appInstanceId },
      from,
    } = msg;
    const invalidProposal = await appProposalValidation[matchedApp.name](
      params,
      from,
      matchedApp,
      this.connext,
    );

    if (invalidProposal) {
      // reject app installation
      this.log.error(`Proposed app is invalid. ${invalidProposal}`);
      await this.connext.rejectInstallApp(appInstanceId);
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

    // dont automatically install coin balance refund app
    if (matchedApp.name === SupportedApplications.CoinBalanceRefundApp) {
      return;
    }

    this.log.debug(`Proposal for app install successful, attempting install now...`);
    let res: CFCoreTypes.InstallResult;

    // TODO: determine virtual app in a more resilient way
    // for now only simple transfer apps are virtual apps
    const virtualAppDefs = [this.connext.config.contractAddresses["SimpleTransferApp"]];
    if (virtualAppDefs.includes(params.appDefinition)) {
      res = await this.connext.installVirtualApp(appInstanceId);
    } else {
      res = await this.connext.installApp(appInstanceId);
    }
    this.log.debug(`App installed, res: ${stringify(res)}`);
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
    await this.connext.messaging.subscribe(subject, async (data: any) => {
      this.log.info(`Received message for subscription: ${stringify(data)}`);
      let paymentId: string;
      let encryptedPreImage: string;
      if (data.paymentId) {
        this.log.debug(`Not nested data`);
        paymentId = data.paymentId;
        encryptedPreImage = data.encryptedPreImage;
      } else if (data.data) {
        this.log.debug(`Nested data`);
        const parsedData = JSON.parse(data.data);
        paymentId = parsedData.paymentId;
        encryptedPreImage = parsedData.encryptedPreImage;
      } else {
        throw new Error(`Could not parse data from message: ${stringify(data)}`);
      }

      if (!paymentId || !encryptedPreImage) {
        throw new Error(`Unable to parse transfer details from message ${stringify(data)}`);
      }
      await this.connext.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
      this.log.info(`Successfully reclaimed transfer with paymentId: ${paymentId}`);
    });
  };
}
