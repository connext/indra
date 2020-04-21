import {
  AppInstanceProposal,
  EventNames,
  IChannelSigner,
  ILockService,
  ILoggerService,
  IMessagingService,
  IStoreService,
  Message,
  MethodName,
  MiddlewareContext,
  MinimalTransaction,
  NetworkContext,
  Opcode,
  ProtocolMessage,
  ProtocolMessageData,
  ProtocolName,
  STORE_SCHEMA_VERSION,
  ValidationMiddleware,
  Address,
  PublicIdentifier,
} from "@connext/types";
import { delay, nullLogger } from "@connext/utils";
import { JsonRpcProvider } from "ethers/providers";
import EventEmitter from "eventemitter3";
import { Memoize } from "typescript-memoize";

import { createRpcRouter } from "./methods";
import { IO_SEND_AND_WAIT_TIMEOUT } from "./constants";
import { Deferred } from "./deferred";
import {
  MultisigCommitment,
  SetStateCommitment,
  ConditionalTransactionCommitment,
} from "./ethereum";
import { ProtocolRunner } from "./machine";
import { StateChannel, AppInstance } from "./models";
import ProcessQueue from "./process-queue";
import { RequestHandler } from "./request-handler";
import RpcRouter from "./rpc-router";
import { MethodRequest, MethodResponse, PersistAppType, PersistCommitmentType } from "./types";

export interface NodeConfig {
  // The prefix for any keys used in the store by this Node depends on the
  // execution environment.
  STORE_KEY_PREFIX: string;
}

const REASONABLE_NUM_BLOCKS_TO_WAIT = 1;

export class Node {
  private readonly incoming: EventEmitter;
  private readonly outgoing: EventEmitter;

  private readonly protocolRunner: ProtocolRunner;

  private readonly ioSendDeferrals = new Map<string, Deferred<ProtocolMessage>>();

  /**
   * These properties don't have initializers in the constructor, since they must be initialized
   * asynchronously. This is done via the `asynchronouslySetupUsingRemoteServices` function.
   * Since we have a private constructor and only allow instances of the Node to be created
   * via `create` which immediately calls `asynchronouslySetupUsingRemoteServices`, these are
   * always non-null when the Node is being used.
   */
  protected requestHandler!: RequestHandler;
  public rpcRouter!: RpcRouter;

  static create(
    messagingService: IMessagingService,
    storeService: IStoreService,
    networkContext: NetworkContext,
    nodeConfig: NodeConfig,
    provider: JsonRpcProvider,
    signer: IChannelSigner,
    lockService?: ILockService,
    blocksNeededForConfirmation?: number,
    logger?: ILoggerService,
  ): Promise<Node> {
    const node = new Node(
      signer,
      messagingService,
      storeService,
      nodeConfig,
      provider,
      networkContext,
      blocksNeededForConfirmation,
      logger,
      lockService,
    );

    return node.asynchronouslySetupUsingRemoteServices();
  }

  private constructor(
    private readonly signer: IChannelSigner,
    private readonly messagingService: IMessagingService,
    private readonly storeService: IStoreService,
    private readonly nodeConfig: NodeConfig,
    private readonly provider: JsonRpcProvider,
    public readonly networkContext: NetworkContext,
    public readonly blocksNeededForConfirmation: number = REASONABLE_NUM_BLOCKS_TO_WAIT,
    public readonly log: ILoggerService = nullLogger,
    private readonly lockService?: ILockService,
  ) {
    this.log = log.newContext("CF-Node");
    this.networkContext.provider = this.provider;
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

  private async asynchronouslySetupUsingRemoteServices(): Promise<Node> {
    this.log.info(`Node signer address: ${await this.signer.getAddress()}`);
    this.requestHandler = new RequestHandler(
      this.publicIdentifier,
      this.incoming,
      this.outgoing,
      this.storeService,
      this.messagingService,
      this.protocolRunner,
      this.networkContext,
      this.provider,
      this.signer,
      // // TODO: should the below be replaced by signer?
      // new AutoNonceWallet(
      //   this.signer.privateKey,
      //   // Creating copy of the provider fixes a mysterious big, details:
      //   // https://github.com/ethers-io/ethers.js/issues/761
      //   new JsonRpcProvider(this.provider.connection.url),
      // ),
      this.blocksNeededForConfirmation!,
      new ProcessQueue(this.lockService),
      this.log,
    );
    this.registerMessagingConnection();
    this.rpcRouter = createRpcRouter(this.requestHandler);
    this.requestHandler.injectRouter(this.rpcRouter);
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
      return middleware(protocol, context);
    });
  }

  /**
   * Instantiates a new _ProtocolRunner_ object and attaches middleware
   * for the OP_SIGN, IO_SEND, and IO_SEND_AND_WAIT opcodes.
   */
  private buildProtocolRunner(): ProtocolRunner {
    const protocolRunner = new ProtocolRunner(
      this.networkContext,
      this.provider,
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

    protocolRunner.register(Opcode.IO_SEND, async (args: [ProtocolMessageData]) => {
      const [data] = args;

      await this.messagingService.send(data.to, {
        data,
        from: this.publicIdentifier,
        type: EventNames.PROTOCOL_MESSAGE_EVENT,
      } as ProtocolMessage);
    });

    protocolRunner.register(Opcode.IO_SEND_AND_WAIT, async (args: [ProtocolMessageData]) => {
      const [data] = args;

      const deferral = new Deferred<ProtocolMessage>();

      this.ioSendDeferrals.set(data.processID, deferral);

      const counterpartyResponse = deferral.promise;

      await this.messagingService.send(data.to, {
        data,
        from: this.publicIdentifier,
        type: EventNames.PROTOCOL_MESSAGE_EVENT,
      } as ProtocolMessage);

      // 90 seconds is the default lock acquiring time time
      const msg = await Promise.race([counterpartyResponse, delay(IO_SEND_AND_WAIT_TIMEOUT)]);

      if (!msg || !("data" in (msg as ProtocolMessage))) {
        throw new Error(
          `IO_SEND_AND_WAIT timed out after 90s waiting for counterparty reply in ${data.protocol}`,
        );
      }

      // Removes the deferral from the list of pending defferals after
      // its promise has been resolved and the necessary callback (above)
      // has been called. Note that, as is, only one defferal can be open
      // per counterparty at the moment.
      this.ioSendDeferrals.delete(data.processID);

      return (msg as ProtocolMessage).data;
    });

    protocolRunner.register(
      Opcode.PERSIST_STATE_CHANNEL,
      async (args: [StateChannel, MinimalTransaction, SetStateCommitment]) => {
        const [stateChannel, signedSetupCommitment, signedFreeBalanceUpdate] = args;
        await this.storeService.createStateChannel(
          stateChannel.toJson(),
          signedSetupCommitment,
          signedFreeBalanceUpdate.toJson(),
        );
        await this.storeService.updateSchemaVersion(STORE_SCHEMA_VERSION);
      },
    );

    protocolRunner.register(
      Opcode.PERSIST_COMMITMENT,
      async (
        args: [
          PersistCommitmentType,
          MultisigCommitment | SetStateCommitment | MinimalTransaction,
          string,
        ],
      ) => {
        const [commitmentType, commitment, identifier] = args;

        switch (commitmentType) {
          case PersistCommitmentType.CreateSetup: {
            this.log.warn(`Deprecated method called: PersistCommitmentType.CreateSetup`);
            break;
          }
          case PersistCommitmentType.CreateConditional: {
            await this.storeService.createConditionalTransactionCommitment(
              identifier,
              (commitment as ConditionalTransactionCommitment).toJson(),
            );
            break;
          }
          case PersistCommitmentType.UpdateConditional: {
            await this.storeService.updateConditionalTransactionCommitment(
              identifier,
              (commitment as ConditionalTransactionCommitment).toJson(),
            );
            break;
          }
          case PersistCommitmentType.CreateSetState: {
            this.log.warn(`Deprecated method called: PersistCommitmentType.CreateSetState`);
            break;
          }
          case PersistCommitmentType.UpdateSetState: {
            await this.storeService.updateSetStateCommitment(
              identifier,
              (commitment as SetStateCommitment).toJson(),
            );
            break;
          }
          case PersistCommitmentType.CreateWithdrawal: {
            await this.storeService.createWithdrawalCommitment(
              identifier,
              commitment as MinimalTransaction,
            );
            break;
          }
          case PersistCommitmentType.UpdateWithdrawal: {
            await this.storeService.updateWithdrawalCommitment(
              identifier,
              commitment as MinimalTransaction,
            );
            break;
          }
          default: {
            throw new Error(`Unrecognized commitment type: ${commitmentType}`);
          }
        }
      },
    );

    protocolRunner.register(
      Opcode.PERSIST_APP_INSTANCE,
      async (
        args: [
          PersistAppType,
          StateChannel,
          AppInstance | AppInstanceProposal,
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

        switch (type) {
          case PersistAppType.CreateProposal: {
            await this.storeService.createAppProposal(
              multisigAddress,
              app as AppInstanceProposal,
              numProposedApps,
              signedSetStateCommitment.toJson(),
            );
            break;
          }

          case PersistAppType.RemoveProposal: {
            await this.storeService.removeAppProposal(multisigAddress, identityHash);
            break;
          }

          case PersistAppType.CreateInstance: {
            await this.storeService.createAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
              freeBalance.toJson(),
              signedSetStateCommitment.toJson(),
              signedConditionalTxCommitment.toJson(),
            );
            break;
          }

          case PersistAppType.UpdateInstance: {
            await this.storeService.updateAppInstance(
              multisigAddress,
              (app as AppInstance).toJson(),
            );
            break;
          }

          case PersistAppType.RemoveInstance: {
            await this.storeService.removeAppInstance(
              multisigAddress,
              identityHash,
              freeBalance.toJson(),
            );
            break;
          }

          case PersistAppType.Reject: {
            await this.storeService.removeAppProposal(multisigAddress, identityHash);
            break;
          }

          default: {
            throw new Error(`Unrecognized app persistence call: ${type}`);
          }
        }
      },
    );

    return protocolRunner;
  }

  /**
   * This is the entrypoint to listening for messages from other Nodes.
   * Delegates setting up a listener to the Node's outgoing EventEmitter.
   * @param event
   * @param callback
   */
  on(event: EventNames | MethodName, callback: (res: any) => void) {
    this.rpcRouter.subscribe(event, async (res: any) => callback(res));
  }

  /**
   * Stops listening for a given message from other Nodes. If no callback is passed,
   * all callbacks are removed.
   *
   * @param event
   * @param [callback]
   */
  off(event: EventNames | MethodName, callback?: (res: any) => void) {
    this.rpcRouter.unsubscribe(event, callback ? async (res: any) => callback(res) : undefined);
  }

  /**
   * This is the entrypoint to listening for messages from other Nodes.
   * Delegates setting up a listener to the Node's outgoing EventEmitter.
   * It'll run the callback *only* once.
   *
   * @param event
   * @param [callback]
   */
  once(event: EventNames | MethodName, callback: (res: any) => void) {
    this.rpcRouter.subscribeOnce(event, async (res: any) => callback(res));
  }

  /**
   * Delegates emitting events to the Node's incoming EventEmitter.
   * @param event
   * @param req
   */
  emit(event: EventNames | MethodName, req: MethodRequest) {
    this.rpcRouter.emit(event, req);
  }

  /**
   * Makes a direct call to the Node for a specific method.
   * @param method
   * @param req
   */
  async call(method: MethodName, req: MethodRequest): Promise<MethodResponse> {
    return this.requestHandler.callMethod(method, req);
  }

  /**
   * When a Node is first instantiated, it establishes a connection
   * with the messaging service. When it receives a message, it emits
   * the message to its registered subscribers, usually external
   * subscribed (i.e. consumers of the Node).
   */
  private registerMessagingConnection() {
    this.messagingService.onReceive(this.publicIdentifier, async (msg: Message) => {
      await this.handleReceivedMessage(msg);
      this.rpcRouter.emit(msg.type, msg, "outgoing");
    });
  }

  /**
   * Messages received by the Node fit into one of three categories:
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
  private async handleReceivedMessage(msg: Message) {
    if (!Object.values(EventNames).includes(msg.type)) {
      this.log.error(`Received message with unknown event type: ${msg.type}`);
    }

    const isProtocolMessage = (msg: Message) => msg.type === EventNames.PROTOCOL_MESSAGE_EVENT;

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
      throw new Error("Node received message intended for machine but no handler was present");
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
