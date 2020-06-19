import {
  Address,
  AppInstanceJson,
  ContractAddresses,
  EventNames,
  IChannelSigner,
  ILockService,
  ILoggerService,
  IMessagingService,
  IStoreService,
  ProtocolEventMessage,
  MethodName,
  MethodNames,
  MethodParams,
  MiddlewareContext,
  MinimalTransaction,
  NetworkContext,
  Opcode,
  ProtocolMessage,
  ProtocolMessageData,
  ProtocolName,
  PublicIdentifier,
  STORE_SCHEMA_VERSION,
  ValidationMiddleware,
  EventName,
} from "@connext/types";
import { delay, nullLogger, stringify } from "@connext/utils";
import { providers } from "ethers";
import EventEmitter from "eventemitter3";
import { Memoize } from "typescript-memoize";

import { UNASSIGNED_SEQ_NO, IO_SEND_AND_WAIT_TIMEOUT } from "./constants";
import { Deferred } from "./deferred";
import { SetStateCommitment, ConditionalTransactionCommitment } from "./ethereum";
import { ProtocolRunner } from "./machine";
import { StateChannel, AppInstance } from "./models";
import { RequestHandler } from "./request-handler";
import { RpcRouter } from "./rpc-router";
import { MethodRequest, MethodResponse, PersistAppType, PersistStateChannelType } from "./types";

export interface NodeConfig {
  STORE_KEY_PREFIX: string;
}

const REASONABLE_NUM_BLOCKS_TO_WAIT = 1;

export class CFCore {
  private readonly incoming: EventEmitter;
  private readonly outgoing: EventEmitter;
  private readonly ioSendDeferrals = new Map<string, Deferred<ProtocolMessage>>();
  private readonly protocolRunner: ProtocolRunner;

  public readonly networkContext: NetworkContext;

  /**
   * These properties don't have initializers in the constructor, since they must be initialized
   * asynchronously. This is done via the `asynchronouslySetupUsingRemoteServices` function.
   * Since we have a private constructor and only allow instances of CFCore to be created
   * via `create` which immediately calls `asynchronouslySetupUsingRemoteServices`, these are
   * always non-null when CFCore is being used.
   */
  protected requestHandler!: RequestHandler;
  public rpcRouter!: RpcRouter;

  static create(
    messagingService: IMessagingService,
    storeService: IStoreService,
    contractAddresses: ContractAddresses,
    nodeConfig: NodeConfig,
    provider: providers.JsonRpcProvider,
    signer: IChannelSigner,
    lockService: ILockService,
    blocksNeededForConfirmation?: number,
    logger?: ILoggerService,
    syncOnStart: boolean = true,
  ): Promise<CFCore> {
    const node = new CFCore(
      signer,
      messagingService,
      storeService,
      nodeConfig,
      provider,
      contractAddresses,
      blocksNeededForConfirmation,
      logger,
      lockService,
    );

    return node.asynchronouslySetupUsingRemoteServices(syncOnStart);
  }

  private constructor(
    private readonly signer: IChannelSigner,
    private readonly messagingService: IMessagingService,
    private readonly storeService: IStoreService,
    private readonly nodeConfig: NodeConfig,
    private readonly provider: providers.JsonRpcProvider,
    public readonly contractAddresses: ContractAddresses,
    public readonly blocksNeededForConfirmation: number = REASONABLE_NUM_BLOCKS_TO_WAIT,
    public readonly log: ILoggerService = nullLogger,
    private readonly lockService: ILockService,
  ) {
    this.log = log.newContext("CFCore");
    this.networkContext = { contractAddresses: this.contractAddresses, provider: this.provider };
    this.incoming = new EventEmitter();
    this.outgoing = new EventEmitter();
    this.protocolRunner = this.buildProtocolRunner();
  }

  @Memoize()
  get signerAddress(): Address {
    return this.signer.address;
  }

  @Memoize()
  get publicIdentifier(): PublicIdentifier {
    return this.signer.publicIdentifier;
  }

  private async asynchronouslySetupUsingRemoteServices(syncOnStart: boolean): Promise<CFCore> {
    this.log.info(`CFCore signer address: ${await this.signer.getAddress()}`);
    this.requestHandler = new RequestHandler(
      this.publicIdentifier,
      this.incoming,
      this.outgoing,
      this.storeService,
      this.messagingService,
      this.protocolRunner,
      this.networkContext,
      this.signer,
      this.blocksNeededForConfirmation!,
      this.lockService,
      this.log,
    );
    this.registerMessagingConnection();
    this.rpcRouter = new RpcRouter(this.requestHandler);
    this.requestHandler.injectRouter(this.rpcRouter);
    if (!syncOnStart) {
      return this;
    }
    const channels = await this.storeService.getAllChannels();
    await Promise.all(
      channels.map(async (channel) => {
        await this.rpcRouter.dispatch({
          methodName: MethodNames.chan_sync,
          parameters: { multisigAddress: channel.multisigAddress } as MethodParams.Sync,
          id: Date.now(),
        });
      }),
    );
    return this;
  }

  /**
   * Attaches middleware for the chosen opcode. Currently, only `OP_VALIDATE`
   * is accepted as an injected middleware
   */
  public injectMiddleware(opcode: Opcode, middleware: ValidationMiddleware): void {
    if (opcode !== Opcode.OP_VALIDATE) {
      throw new Error(`Cannot inject middleware for opcode: ${opcode}`);
    }
    this.protocolRunner.register(opcode, async (args: [ProtocolName, MiddlewareContext]) => {
      const [protocol, context] = args;
      try {
        await middleware(protocol, context);
        return undefined;
      } catch (e) {
        return e.stack || e.message;
      }
    });
  }

  /**
   * Instantiates a new _ProtocolRunner_ object and attaches middleware
   * for the OP_SIGN, IO_SEND, and IO_SEND_AND_WAIT opcodes.
   */
  private buildProtocolRunner(): ProtocolRunner {
    const protocolRunner = new ProtocolRunner(
      this.networkContext,
      this.storeService,
      this.log.newContext("CF-ProtocolRunner"),
    );

    protocolRunner.register(Opcode.OP_SIGN, async (args: any[]) => {
      if (args.length !== 1) {
        throw new Error("OP_SIGN middleware received wrong number of arguments.");
      }

      const [commitmentHash] = args;

      return this.signer.signMessage(commitmentHash);
    });

    protocolRunner.register(
      Opcode.IO_SEND,
      async (args: [ProtocolMessageData, StateChannel, AppInstance]) => {
        const [data, channel, appContext] = args;

        // check if the protocol start time exists within the message
        // and if it is a final protocol message (see note in
        // types/messaging.ts)
        const { prevMessageReceived, seq } = data;
        if (prevMessageReceived && seq === UNASSIGNED_SEQ_NO) {
          const diff = Date.now() - prevMessageReceived;
          if (diff > IO_SEND_AND_WAIT_TIMEOUT) {
            throw new Error(
              `Execution took longer than ${
                IO_SEND_AND_WAIT_TIMEOUT / 1000
              }s. Aborting message: ${stringify(data)}`,
            );
          }
        }

        await this.messagingService.send(data.to, {
          data,
          from: this.publicIdentifier,
          type: EventNames.PROTOCOL_MESSAGE_EVENT,
        } as ProtocolMessage);

        return { channel, appContext };
      },
    );

    protocolRunner.register(
      Opcode.IO_SEND_AND_WAIT,
      async (args: [ProtocolMessageData, StateChannel, AppInstance]) => {
        const [data, channel, appContext] = args;

        const deferral = new Deferred<ProtocolMessage>();

        this.ioSendDeferrals.set(data.processID, deferral);

        const counterpartyResponse = deferral.promise;

        await this.messagingService.send(data.to, {
          data,
          from: this.publicIdentifier,
          type: EventNames.PROTOCOL_MESSAGE_EVENT,
        } as ProtocolMessage);

        // 10 seconds is the default lock acquiring time time
        const msg = await Promise.race<ProtocolMessage | void>([
          counterpartyResponse,
          delay(IO_SEND_AND_WAIT_TIMEOUT),
        ]);

        if (!msg || !msg.data) {
          throw new Error(
            `IO_SEND_AND_WAIT timed out after ${
              IO_SEND_AND_WAIT_TIMEOUT / 1000
            }s waiting for counterparty reply in ${data.protocol}`,
          );
        }

        // Removes the deferral from the list of pending defferals after
        // its promise has been resolved and the necessary callback (above)
        // has been called. Note that, as is, only one defferal can be open
        // per counterparty at the moment.
        this.ioSendDeferrals.delete(data.processID);

        // Check if there is an error reason in the response, and throw
        // the error here if so
        // NOTE: only errors that are thrown from protocol execution when the
        // counterparty is waiting for a response should be sent
        const { error } = msg.data;
        if (error) {
          throw new Error(
            `Counterparty execution of ${
              data.protocol
            } failed: ${error}. \nCounterparty was responding to: ${stringify(data)}`,
          );
        }

        return { data: msg.data, channel, appContext };
      },
    );

    protocolRunner.register(
      Opcode.PERSIST_STATE_CHANNEL,
      async (
        args: [
          PersistStateChannelType,
          StateChannel,
          (MinimalTransaction | SetStateCommitment | ConditionalTransactionCommitment)[],
          AppInstance, // uninstalled app context
        ],
      ) => {
        const [type, stateChannel, signedCommitments, appContext] = args;
        switch (type) {
          case PersistStateChannelType.CreateChannel: {
            const [setup, freeBalance] = signedCommitments as [
              MinimalTransaction,
              SetStateCommitment,
            ];
            await this.storeService.createStateChannel(
              stateChannel.toJson(),
              setup,
              freeBalance.toJson(),
            );

            await this.storeService.updateSchemaVersion(STORE_SCHEMA_VERSION);
            break;
          }

          case PersistStateChannelType.SyncNumProposedApps: {
            await this.storeService.incrementNumProposedApps(stateChannel.multisigAddress);
            break;
          }

          case PersistStateChannelType.SyncProposal: {
            const [setState, conditional] = signedCommitments as [
              SetStateCommitment,
              ConditionalTransactionCommitment,
            ];
            const proposal = stateChannel.proposedAppInstances.get(setState.appIdentityHash);
            if (!proposal) {
              throw new Error("Could not find proposal in post protocol channel");
            }
            // this is adding a proposal
            await this.storeService.createAppProposal(
              stateChannel.multisigAddress,
              proposal,
              stateChannel.numProposedApps,
              setState.toJson(),
              conditional.toJson(),
              stateChannel.toJson(),
            );
            break;
          }
          case PersistStateChannelType.NoChange: {
            break;
          }
          case PersistStateChannelType.SyncFreeBalance: {
            const [setState] = signedCommitments as [SetStateCommitment];
            if (appContext) {
              // this was an uninstall, so remove app instance
              await this.storeService.removeAppInstance(
                stateChannel.multisigAddress,
                appContext.identityHash,
                stateChannel.toJson().freeBalanceAppInstance!,
                setState.toJson(),
                stateChannel.toJson(),
              );
            } else {
              const latestInstalled = stateChannel
                .getAppInstanceByAppSeqNo(stateChannel.numProposedApps)
                .toJson();
              // this was an install, add app and remove proposals
              await this.storeService.createAppInstance(
                stateChannel.multisigAddress,
                latestInstalled,
                stateChannel.freeBalance.toJson(),
                setState.toJson(),
                stateChannel.toJson(),
              );
            }
            break;
          }
          case PersistStateChannelType.SyncAppInstances: {
            for (const commitment of signedCommitments as SetStateCommitment[]) {
              await this.storeService.updateAppInstance(
                stateChannel.multisigAddress,
                stateChannel.appInstances.get(commitment.appIdentityHash)!.toJson(),
                commitment.toJson(),
                stateChannel.toJson(),
              );
            }
            break;
          }
          default: {
            const c: never = type;
            throw new Error(`Unrecognized persist state channel type: ${c}`);
          }
        }
        return { channel: stateChannel };
      },
    );

    protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (
        args: [
          PersistAppType,
          StateChannel,
          AppInstance | AppInstanceJson,
          SetStateCommitment,
          ConditionalTransactionCommitment,
        ],
      ) => {
        const [
          type,
          postProtocolChannel,
          app,
          signedSetStateCommitment,
          signedConditionalTxCommitment,
        ] = args;
        const { multisigAddress, numProposedApps, freeBalance } = postProtocolChannel;
        const { identityHash } = app;
        let appContext: AppInstance | AppInstanceJson | undefined;
        switch (type) {
          case PersistAppType.CreateProposal: {
            await this.storeService.createAppProposal(
              multisigAddress,
              app as AppInstanceJson,
              numProposedApps,
              signedSetStateCommitment.toJson(),
              signedConditionalTxCommitment.toJson(),
              postProtocolChannel.toJson(),
            );
            break;
          }

          case PersistAppType.RemoveProposal: {
            await this.storeService.removeAppProposal(
              multisigAddress,
              identityHash,
              postProtocolChannel.toJson(),
            );
            break;
          }

          case PersistAppType.CreateInstance: {
            await this.storeService.createAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
              freeBalance.toJson(),
              signedSetStateCommitment.toJson(),
              postProtocolChannel.toJson(),
            );
            break;
          }

          case PersistAppType.UpdateInstance: {
            await this.storeService.updateAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
              signedSetStateCommitment.toJson(),
              postProtocolChannel.toJson(),
            );
            break;
          }

          case PersistAppType.RemoveInstance: {
            await this.storeService.removeAppInstance(
              multisigAddress,
              identityHash,
              freeBalance.toJson(),
              signedSetStateCommitment.toJson(),
              postProtocolChannel.toJson(),
            );
            // final state of app before uninstall
            appContext = app;
            break;
          }

          case PersistAppType.Reject: {
            await this.storeService.removeAppProposal(
              multisigAddress,
              identityHash,
              postProtocolChannel.toJson(),
            );
            break;
          }

          default: {
            const c: never = type;
            throw new Error(`Unrecognized app persistence call: ${c}`);
          }
        }

        return { channel: postProtocolChannel, appContext };
      },
    );

    return protocolRunner;
  }

  /**
   * This is the entrypoint to listening for messages from other CFCores.
   * Delegates setting up a listener to CFCore's outgoing EventEmitter.
   * @param event
   * @param callback
   */
  on(event: EventName | MethodName, callback: (res: any) => void) {
    this.rpcRouter.subscribe(event, async (res: any) => callback(res));
  }

  /**
   * Stops listening for a given message from other CFCores. If no callback is passed,
   * all callbacks are removed.
   *
   * @param event
   * @param [callback]
   */
  off(event: EventName | MethodName, callback?: (res: any) => void) {
    this.rpcRouter.unsubscribe(event, callback ? async (res: any) => callback(res) : undefined);
  }

  /**
   * This is the entrypoint to listening for messages from other CFCores.
   * Delegates setting up a listener to CFCore's outgoing EventEmitter.
   * It'll run the callback *only* once.
   *
   * @param event
   * @param [callback]
   */
  once(event: EventName | MethodName, callback: (res: any) => void) {
    this.rpcRouter.subscribeOnce(event, async (res: any) => callback(res));
  }

  /**
   * Delegates emitting events to CFCore's incoming EventEmitter.
   * @param event
   * @param req
   */
  emit(event: EventName | MethodName, req: MethodRequest) {
    this.rpcRouter.emit(event, req);
  }

  /**
   * Makes a direct call to CFCore for a specific method.
   * @param method
   * @param req
   */
  async call(method: MethodName, req: MethodRequest): Promise<MethodResponse> {
    return this.requestHandler.callMethod(method, req);
  }

  /**
   * When CFCore is first instantiated, it establishes a connection
   * with the messaging service. When it receives a message, it emits
   * the message to its registered subscribers, usually external
   * subscribed (i.e. consumers of CFCore).
   */
  private registerMessagingConnection() {
    this.messagingService.onReceive(
      this.publicIdentifier,
      async (msg: ProtocolEventMessage<any>) => {
        try {
          await this.handleReceivedMessage(msg);
          this.rpcRouter.emit(msg.type, msg, "outgoing");
        } catch (e) {
          // No need to crash the entire cfCore if we receive an invalid message.
          // Just log & wait for the next one
          this.log.error(`Failed to handle ${msg.type} message: ${e.message}`);
        }
      },
    );
  }

  /**
   * Messages received by CFCore fit into one of three categories:
   *
   * (a) A Message which is _not_ a ProtocolMessage;
   *     this is a standard received message which is handled by a named
   *     controller in the _events_ folder.
   *
   * (b) A Message which is a ProtocolMessage _and_
   *     has no registered _ioSendDeferral_ callback. In this case, it means
   *     it will be sent to the protocol message event controller to dispatch
   *     the received message to the instruction executor.
   *
   * (c) A Message which is a ProtocolMessage _and_
   *     _does have_ an _ioSendDeferral_, in which case the message is dispatched
   *     solely to the deffered promise's resolve callback.
   */
  private async handleReceivedMessage(msg: ProtocolEventMessage<any>) {
    if (!Object.values(EventNames).includes(msg.type)) {
      this.log.error(`Received message with unknown event type: ${msg.type}`);
    }

    const isProtocolMessage = (msg: ProtocolEventMessage<any>) =>
      msg.type === EventNames.PROTOCOL_MESSAGE_EVENT;

    const isExpectingResponse = (msg: ProtocolMessage) =>
      this.ioSendDeferrals.has(msg.data.processID);
    if (isProtocolMessage(msg) && isExpectingResponse(msg as ProtocolMessage)) {
      await this.handleIoSendDeferral(msg as ProtocolMessage);
    } else if (this.requestHandler.isLegacyEvent(msg.type)) {
      await this.requestHandler.callEvent(msg.type, msg);
    } else {
      await this.rpcRouter.emit(msg.type, msg);
    }
  }

  private async handleIoSendDeferral(msg: ProtocolMessage) {
    const key = msg.data.processID;

    if (!this.ioSendDeferrals.has(key)) {
      throw new Error("CFCore received message intended for machine but no handler was present");
    }

    const promise = this.ioSendDeferrals.get(key)!;

    try {
      promise.resolve(msg);
    } catch (error) {
      this.log.error(
        `Error while executing callback registered by IO_SEND_AND_WAIT middleware hook error ${JSON.stringify(
          error,
          null,
          2,
        )} msg ${JSON.stringify(msg, null, 2)}`,
      );
    }
  }
}
