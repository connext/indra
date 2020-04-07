import {
  bigNumberifyJson,
  DepositAppName,
  EventNames,
  EventPayloads,
  HashLockTransferAppName,
  ILoggerService,
  MethodNames,
  MethodParams,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  WithdrawAppName,
  WithdrawAppState,
  SimpleSignedTransferAppState,
  deBigNumberifyJson,
  CreatedSignedTransferMeta,
  ConditionalTransferTypes,
  SignedTransfer,
  SimpleLinkedTransferAppState,
  CreatedLinkedTransferMeta,
  CreatedHashLockTransferMeta,
  HashLockTransferAppState,
} from "@connext/types";
import {
  commonAppProposalValidation,
  SupportedApplications,
  validateSimpleLinkedTransferApp,
  validateWithdrawApp,
  validateHashLockTransferApp,
  validateSignedTransferApp,
  validateDepositApp,
} from "@connext/apps";

import { ConnextClient } from "./connext";
import { stringify } from "./lib";
import {
  CreateChannelMessage,
  ConnextEventEmitter,
  DefaultApp,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  IChannelProvider,
  InstallMessage,
  NodeMessageWrappedProtocolMessage,
  ProposeMessage,
  RejectProposalMessage,
  UninstallMessage,
  UpdateStateMessage,
} from "./types";

const {
  CONDITIONAL_TRANSFER_CREATED_EVENT,
  CONDITIONAL_TRANSFER_RECEIVED_EVENT,
  CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  CONDITIONAL_TRANSFER_FAILED_EVENT,
  WITHDRAWAL_CONFIRMED_EVENT,
  WITHDRAWAL_FAILED_EVENT,
  WITHDRAWAL_STARTED_EVENT,
  CREATE_CHANNEL_EVENT,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DEPOSIT_STARTED_EVENT,
  INSTALL_EVENT,
  PROPOSE_INSTALL_EVENT,
  PROTOCOL_MESSAGE_EVENT,
  REJECT_INSTALL_EVENT,
  UNINSTALL_EVENT,
  UPDATE_STATE_EVENT,
} = EventNames;

// TODO: index of connext events only?
type CallbackStruct = {
  [index in EventNames]: (data: any) => Promise<any> | void;
};

export class ConnextListener extends ConnextEventEmitter {
  private log: ILoggerService;
  private channelProvider: IChannelProvider;
  private connext: ConnextClient;

  // TODO: add custom parsing functions here to convert event data
  // to something more usable? -- OR JUST FIX THE EVENT DATA! :p
  private defaultCallbacks: CallbackStruct = {
    CREATE_CHANNEL_EVENT: (msg: CreateChannelMessage): void => {
      this.emitAndLog(CREATE_CHANNEL_EVENT, msg.data);
    },
    CONDITIONAL_TRANSFER_CREATED_EVENT: (msg: any): void => {
      this.emitAndLog(CONDITIONAL_TRANSFER_CREATED_EVENT, msg.data);
    },
    CONDITIONAL_TRANSFER_RECEIVED_EVENT: (msg: any): void => {
      this.emitAndLog(CONDITIONAL_TRANSFER_RECEIVED_EVENT, msg.data);
    },
    CONDITIONAL_TRANSFER_UNLOCKED_EVENT: (msg: any): void => {
      this.emitAndLog(CONDITIONAL_TRANSFER_UNLOCKED_EVENT, msg.data);
    },
    CONDITIONAL_TRANSFER_FAILED_EVENT: (msg: any): void => {
      this.emitAndLog(CONDITIONAL_TRANSFER_FAILED_EVENT, msg.data);
    },
    DEPOSIT_CONFIRMED_EVENT: async (msg: DepositConfirmationMessage): Promise<void> => {
      this.emitAndLog(DEPOSIT_CONFIRMED_EVENT, msg.data);
    },
    DEPOSIT_FAILED_EVENT: (msg: DepositFailedMessage): void => {
      this.emitAndLog(DEPOSIT_FAILED_EVENT, msg.data);
    },
    DEPOSIT_STARTED_EVENT: (msg: DepositStartedMessage): void => {
      this.log.info(`Deposit transaction: ${msg.data.txHash}`);
      this.emitAndLog(DEPOSIT_STARTED_EVENT, msg.data);
    },
    INSTALL_EVENT: (msg: InstallMessage): void => {
      this.emitAndLog(INSTALL_EVENT, msg.data);
    },
    PROPOSE_INSTALL_EVENT: async (msg: ProposeMessage): Promise<void> => {
      const {
        data: { params, appIdentityHash },
        from,
      } = msg;
      // return if its from us
      const start = Date.now();
      const time = () => `in ${Date.now() - start} ms`;
      if (from === this.connext.publicIdentifier) {
        this.log.debug(`Received proposal from our own node, doing nothing ${time()}`);
        return;
      }
      // validate and automatically install for the known and supported
      // applications
      this.emitAndLog(PROPOSE_INSTALL_EVENT, msg.data);
      this.handleAppProposal(params, appIdentityHash, from);
      this.log.info(`Done processing propose install event ${time()}`);
    },
    PROTOCOL_MESSAGE_EVENT: (msg: NodeMessageWrappedProtocolMessage): void => {
      this.emitAndLog(PROTOCOL_MESSAGE_EVENT, msg.data);
    },
    REJECT_INSTALL_EVENT: (msg: RejectProposalMessage): void => {
      this.emitAndLog(REJECT_INSTALL_EVENT, msg.data);
    },
    UNINSTALL_EVENT: (msg: UninstallMessage): void => {
      this.emitAndLog(UNINSTALL_EVENT, msg.data);
    },
    UPDATE_STATE_EVENT: async (msg: UpdateStateMessage): Promise<void> => {
      this.emitAndLog(UPDATE_STATE_EVENT, msg.data);
      const appInstance = (await this.connext.getAppInstance(msg.data.appIdentityHash))
        .appInstance;
      const state = msg.data.newState as WithdrawAppState;
      const registryAppInfo = this.connext.appRegistry.find((app: DefaultApp): boolean => {
        return app.appDefinitionAddress === appInstance.appInterface.addr;
      });
      if (registryAppInfo.name === WithdrawAppName) {
        const params = {
          amount: state.transfers[0].amount,
          recipient: state.transfers[0].to,
          assetId: appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
          nonce: state.nonce,
        };
        await this.connext.saveWithdrawCommitmentToStore(
          params,
          state.signatures[0], // withdrawer
          state.signatures[1], // counterparty
        );
      }
    },
    WITHDRAWAL_CONFIRMED_EVENT: (msg: UninstallMessage): void => {
      this.emitAndLog(WITHDRAWAL_CONFIRMED_EVENT, msg.data);
    },
    WITHDRAWAL_FAILED_EVENT: (msg: UninstallMessage): void => {
      this.emitAndLog(WITHDRAWAL_FAILED_EVENT, msg.data);
    },
    WITHDRAWAL_STARTED_EVENT: (msg: UninstallMessage): void => {
      this.emitAndLog(WITHDRAWAL_STARTED_EVENT, msg.data);
    },
  };

  constructor(channelProvider: IChannelProvider, connext: ConnextClient) {
    super();
    this.channelProvider = channelProvider;
    this.connext = connext;
    this.log = connext.log.newContext("ConnextListener");
  }

  public register = async (): Promise<void> => {
    await this.registerAvailabilitySubscription();
    this.registerDefaultListeners();
    await this.registerLinkedTransferSubscription();
    return;
  };

  public registerCfListener = (event: EventNames, cb: Function): void => {
    // replace with new fn
    this.log.debug(`Registering listener for ${event}`);
    this.channelProvider.on(
      event,
      async (res: any): Promise<void> => {
        await cb(res);
        this.emit(event, res);
      },
    );
  };

  public removeCfListener = (event: EventNames, cb: Function): boolean => {
    this.log.debug(`Removing listener for ${event}`);
    try {
      this.removeListener(event, cb as any);
      return true;
    } catch (e) {
      this.log.error(
        `Error trying to remove registered listener from event ${event}: ${e.stack || e.message}`,
      );
      return false;
    }
  };

  public registerDefaultListeners = (): void => {
    Object.entries(this.defaultCallbacks).forEach(([event, callback]: any): any => {
      this.channelProvider.on(event, callback);
    });

    this.channelProvider.on(
      MethodNames.chan_install,
      async (msg: any): Promise<void> => {
        const {
          result: {
            result: { appInstance },
          },
        } = msg;
        await this.connext.messaging.publish(
          `${this.connext.publicIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appInstance.appIdentityHash}.uninstall`,
          appInstance,
        );
      },
    );
  };

  private emitAndLog = (event: EventNames, data: any): void => {
    const protocol =
      event === PROTOCOL_MESSAGE_EVENT ? (data.data ? data.data.protocol : data.protocol) : "";
    this.log.debug(`Received ${event}${protocol ? ` for ${protocol} protocol` : ""}`);
    this.emit(event, bigNumberifyJson(data));
  };

  private registerAvailabilitySubscription = async (): Promise<void> => {
    const subject = `${this.connext.publicIdentifier}.online`;
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
    const subject = `*.channel.*.transfer.linked.to.${this.connext.publicIdentifier}`;
    await this.connext.messaging.subscribe(subject, async (msg: any) => {
      this.log.debug(`Received message for ${subject} subscription`);
      if (!msg.paymentId && !msg.data) {
        throw new Error(`Could not parse data from message: ${stringify(msg)}`);
      }
      let data = msg.paymentId ? msg : msg.data;
      if (typeof data === `string`) {
        data = JSON.parse(data);
      }
      this.log.debug(`Message data: ${JSON.stringify(data, null, 2)}`);
      const {
        paymentId,
        transferMeta: { encryptedPreImage },
        amount,
        assetId,
      }: EventPayloads.LinkedTransferCreated = data;
      if (!paymentId || !encryptedPreImage || !amount || !assetId) {
        throw new Error(`Unable to parse transfer details from message ${stringify(data)}`);
      }
      await this.connext.reclaimPendingAsyncTransfer(paymentId, encryptedPreImage);
      this.log.info(`Successfully redeemed transfer with paymentId: ${paymentId}`);
    });
  };

  private handleAppProposal = async (
    params: MethodParams.ProposeInstall,
    appIdentityHash: string,
    from: string,
  ): Promise<void> => {
    // get supported apps
    const registryAppInfo = this.connext.appRegistry.find((app: DefaultApp): boolean => {
      return app.appDefinitionAddress === params.appDefinition;
    });
    if (!registryAppInfo) {
      throw new Error(`Could not find registry info for app ${params.appDefinition}`);
    }
    // validate or reject app
    try {
      // check based on supported applications
      commonAppProposalValidation(
        params,
        // types weirdness
        { ...registryAppInfo, name: registryAppInfo.name as SupportedApplications },
        this.connext.config.supportedTokenAddresses,
      );
      switch (registryAppInfo.name) {
        case SimpleLinkedTransferAppName: {
          validateSimpleLinkedTransferApp(params, from, this.connext.publicIdentifier);
          break;
        }
        case WithdrawAppName: {
          await validateWithdrawApp(params, from, this.connext.publicIdentifier);
          break;
        }
        case HashLockTransferAppName: {
          const blockNumber = await this.connext.ethProvider.getBlockNumber();
          validateHashLockTransferApp(params, blockNumber, from, this.connext.publicIdentifier);
          break;
        }
        case SimpleSignedTransferAppName: {
          validateSignedTransferApp(params, from, this.connext.publicIdentifier);
          break;
        }
        case DepositAppName: {
          await validateDepositApp(
            params,
            from,
            this.connext.publicIdentifier,
            this.connext.multisigAddress,
            this.connext.ethProvider,
          );
          break;
        }
        default: {
          throw new Error(
            `Not installing app without configured validation: ${registryAppInfo.name}`,
          );
        }
      }
      // NOTE: by trying to install here, if the installation fails,
      // the proposal is automatically removed from the store
      await this.connext.installApp(appIdentityHash);
    } catch (e) {
      console.error(`Caught error: ${e.message}`);
      await this.connext.rejectInstallApp(appIdentityHash);
      throw e;
    }
    // install and run post-install tasks
    await this.runPostInstallTasks(appIdentityHash, registryAppInfo, params);
    const { appInstance } = await this.connext.getAppInstance(appIdentityHash);
    await this.connext.messaging.publish(
      `${this.connext.publicIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`,
      stringify(appInstance),
    );
  };

  private runPostInstallTasks = async (
    appIdentityHash: string,
    registryAppInfo: DefaultApp,
    params: MethodParams.ProposeInstall,
  ): Promise<void> => {
    switch (registryAppInfo.name) {
      case WithdrawAppName: {
        const appInstance = (await this.connext.getAppInstance(appIdentityHash)).appInstance;
        this.connext.respondToNodeWithdraw(appInstance);
        break;
      }
      case SimpleSignedTransferAppName: {
        const initalState = params.initialState as SimpleSignedTransferAppState;
        const { initiatorDepositTokenAddress: assetId, meta } = params;
        const amount = initalState.coinTransfers[0].amount;
        this.connext.emit(
          EventNames.CONDITIONAL_TRANSFER_RECEIVED_EVENT,
          deBigNumberifyJson({
            amount,
            appIdentityHash,
            assetId,
            meta,
            sender: meta["sender"],
            transferMeta: {
              signer: initalState.signer,
            } as CreatedSignedTransferMeta,
            type: ConditionalTransferTypes[SignedTransfer],
            paymentId: initalState.paymentId,
            recipient: meta["recipient"],
          }) as EventPayloads.SignedTransferReceived,
        );
        break;
      }
      case HashLockTransferAppName: {
        const initalState = params.initialState as HashLockTransferAppState;
        const { initiatorDepositTokenAddress: assetId, meta } = params;
        const amount = initalState.coinTransfers[0].amount;
        this.connext.emit(
          EventNames.CONDITIONAL_TRANSFER_RECEIVED_EVENT,
          deBigNumberifyJson({
            amount,
            appIdentityHash,
            assetId,
            meta,
            sender: meta["sender"],
            transferMeta: {
              lockHash: initalState.lockHash,
            } as CreatedHashLockTransferMeta,
            type: ConditionalTransferTypes[SignedTransfer],
            paymentId: initalState.lockHash,
            recipient: meta["recipient"],
          }) as EventPayloads.SignedTransferReceived,
        );
        break;
      }
      case SimpleLinkedTransferAppName: {
        const initalState = params.initialState as SimpleLinkedTransferAppState;
        const { initiatorDepositTokenAddress: assetId, meta } = params;
        const amount = initalState.coinTransfers[0].amount;
        this.connext.emit(
          EventNames.CONDITIONAL_TRANSFER_RECEIVED_EVENT,
          deBigNumberifyJson({
            amount,
            appIdentityHash,
            assetId,
            meta,
            sender: meta["sender"],
            transferMeta: {
              encryptedPreImage: meta["encryptedPreImage"],
            } as CreatedLinkedTransferMeta,
            type: ConditionalTransferTypes[SignedTransfer],
            paymentId: initalState.paymentId,
            recipient: meta["recipient"],
          }) as EventPayloads.LinkedTransferReceived,
        );
        break;
      }
    }
  };
}
