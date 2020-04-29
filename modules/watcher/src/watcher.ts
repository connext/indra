import { Contract, BigNumber, providers, utils } from "ethers";
import {
  ChallengeRegistry,
  ConditionalTransactionCommitment,
  SetStateCommitment,
} from "@connext/contracts";
import {
  AppChallenge,
  AppIdentity,
  AppInstanceJson,
  ChallengeEvents,
  IChannelSigner,
  ILoggerService,
  IWatcher,
  IWatcherStoreService,
  MinimalTransaction,
  NetworkContext,
  SignedCancelChallengeRequest,
  StateChannelJSON,
  WatcherEvent,
  WatcherEventData,
  WatcherInitOptions,
} from "@connext/types";
import {
  ConsoleLogger,
  ChannelSigner,
  getSignerAddressFromPublicIdentifier,
  nullLogger,
  toBN,
} from "@connext/utils";
import EventEmitter from "eventemitter3";
import { Contract, BigNumber } from "ethers";

import { ChainListener } from "./chainListener";

/**
 * Watchers will watch for contract events and respond to disputes on behalf
 * of channel participants. They can also be used to initiate disputes.
 *
 * To use the watcher class, call `await Watcher.init(opts)`, this will
 * automatically begin the dispute response process.
 */
export class Watcher implements IWatcher {
  private log: ILoggerService;
  private enabled: boolean = false;
  private emitter: EventEmitter;
  private challengeRegistry: Contract;

  constructor(
    private readonly signer: IChannelSigner,
    private readonly provider: providers.JsonRpcProvider,
    private readonly context: NetworkContext,
    private readonly store: IWatcherStoreService,
    private readonly listener: ChainListener,
    log: ILoggerService,
  ) {
    this.emitter = new EventEmitter();
    this.log = log.newContext("Watcher");
    this.challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi,
      this.provider,
    );
  }

  /////////////////////////////////////
  //// Static methods

  // used to create a new watcher instance from the passed
  // in options (which are cast to the proper values)
  public static init = async (opts: WatcherInitOptions): Promise<Watcher> => {
    const { logger, signer: providedSigner, provider: ethProvider, context, store } = opts;

    const log =
      logger && typeof (logger as ILoggerService).newContext === "function"
        ? (logger as ILoggerService).newContext("WatcherInit")
        : logger
        ? new ConsoleLogger("WatcherInit", undefined, logger)
        : nullLogger;

    log.debug(`Creating new Watcher`);

    const provider =
      typeof ethProvider === "string" ? new providers.JsonRpcProvider(ethProvider) : ethProvider;

    const signer =
      typeof providedSigner === "string"
        ? new ChannelSigner(providedSigner, provider.connection.url)
        : providedSigner;

    if (!signer.provider) {
      log.warn(`Signer has no connected provider, watcher will not be able to send transactions`);
    }

    const listener = new ChainListener(provider, context, log);
    const watcher = new Watcher(signer, provider, context, store, listener, log);
    await watcher.enable();
    return watcher;
  };

  /////////////////////////////////////
  //// Public methods

  // will begin an onchain dispute. emits a `DisputeInitiated` event if
  // the initiation was successful, otherwise emits a `DisputeFailed`
  // event
  public initiate = async (appInstanceId: string): Promise<void> => {
    throw new Error("Method not implemented");
  };

  public cancel = async (
    appInstanceId: string,
    req: SignedCancelChallengeRequest,
  ): Promise<providers.TransactionResponse> => {
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    const app = await this.store.getAppInstance(appInstanceId);
    if (!app || !channel) {
      throw new Error(`Could not find channel/app for app id: ${appInstanceId}`);
    }
    return this.cancelChallenge(channel, app, req);
  };

  // begins responding to events and starts all listeners
  // also catches up to current block from latest processed
  public enable = async (): Promise<void> => {
    if (this.enabled) {
      this.log.info(`Watcher enabled`);
      return;
    }
    // catch up to current block
    const current = await this.provider.getBlockNumber();
    const previous = await this.store.getLatestProcessedBlock();
    if (previous < current) {
      this.log.debug(`Processing missed events from blocks ${previous} - ${current}`);
      // register any missed events
      await this.catchupTo(previous);
    }

    // register listener for any future events
    this.log.debug(`Enabling listener`);
    await this.listener.enable();
    await this.registerListeners();

    this.enabled = true;
    this.log.info(`Watcher enabled`);
  };

  // pauses all listeners and responses
  public disable = async (): Promise<void> => {
    if (!this.enabled) {
      this.log.info(`Watcher disabled`);
      return;
    }
    const current = await this.provider.getBlockNumber();
    this.log.debug(`Setting latest processed block to ${current}`);
    await this.store.updateLatestProcessedBlock(current);

    this.log.debug(`Disabling listener`);
    await this.listener.disable();

    this.enabled = false;
    this.log.info(`Watcher disabled`);
  };

  //////// Listener methods
  public emit<T extends WatcherEvent>(event: T, data: WatcherEventData[T]): void {
    this.emitter.emit(event, data);
  }

  public on<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void {
    this.emitter.on(event, callback);
  }

  public once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void {
    this.emitter.once(event, callback);
  }

  public removeListener<T extends WatcherEvent>(event: T): void {
    this.emitter.removeListener(event);
  }

  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  /////////////////////////////////////
  //////// Private methods
  // will insert + respond to any events that have occurred from
  // the latest processed block to the provided block
  private catchupTo = async (blockNumber: number): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // processes + responds to any events caught for challenges we did not
  // intiate/are unaware of
  private respondToDispute = async (blockNumber: number): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // should advance (call `setOutcome`, `progressState`, etc.) any active
  // disputes whos dispute period elapses
  private advanceDisputes = async (): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // should check every block for challenges that should be advanced,
  // and respond to any listener emitted chain events
  private registerListeners = async (): Promise<void> => {
    this.listener.on(ChallengeEvents.ChallengeUpdated, async () => {
      throw new Error("Watcher callback not implemented");
    });
    this.listener.on(ChallengeEvents.StateProgressed, async () => {
      throw new Error("Watcher callback not implemented");
    });
    this.provider.on("block", async (blockNumber: number) => {
      await this.advanceDisputes();
    });
  };

  //////// Private contract methods
  private setState = async (
    appIdentityHash: string,
    versionNumber: BigNumber,
  ): Promise<providers.TransactionResponse> => {
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitment = SetStateCommitment.fromJson(
      jsons.filter((x) => toBN(x.versionNumber).eq(toBN(versionNumber)))[0],
    );
    return this.sendContractTransaction(await commitment.getSignedTransaction());
  };

  private sendConditionalTransaction = async (
    appIdentityHash: string,
  ): Promise<providers.TransactionResponse> => {
    const commitmentJson = await this.store.getConditionalTransactionCommitment(appIdentityHash);
    if (!commitmentJson) {
      throw new Error(`No conditional tx commitment exists for app ${appIdentityHash}`);
    }
    const commitment = ConditionalTransactionCommitment.fromJson(commitmentJson);
    return this.sendContractTransaction(commitment.getTransactionDetails());
  };

  private progressState = async (
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<providers.TransactionResponse> => {
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitments = jsons
      .sort((a, b) => toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber())
      .map(SetStateCommitment.fromJson);

    const app = (await this.store.getAppInstance(appIdentityHash)) as AppInstanceJson;
    if (!app) throw new Error(`Can't find app with identity hash: ${appIdentityHash}`);
    const action = utils.defaultAbiCoder.encode(
      [app.appInterface.actionEncoding!],
      [app.latestAction],
    );
    const state = utils.defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);

    const iface = new utils.Interface(ChallengeRegistry.abi);

    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: iface.encodeFunctionData(iface.getFunction("progressState"), [
        this.getAppIdentity(app, multisigAddress),
        await commitments[0].getSignedAppChallengeUpdate(),
        await commitments[1].getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    return this.sendContractTransaction(tx);
  };

  private setAndProgressState = async (
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<providers.TransactionResponse> => {
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitments = jsons
      .sort((a, b) => toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber())
      .map(SetStateCommitment.fromJson);

    const app = (await this.store.getAppInstance(appIdentityHash)) as AppInstanceJson;
    if (!app) throw new Error(`Can't find app with identity hash: ${appIdentityHash}`);
    const action = utils.defaultAbiCoder.encode(
      [app.appInterface.actionEncoding!],
      [app.latestAction],
    );
    const state = utils.defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const iface = new utils.Interface(ChallengeRegistry.abi);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: iface.encodeFunctionData(iface.getFunction("setAndProgressState"), [
        this.getAppIdentity(app, multisigAddress),
        await commitments[0].getSignedAppChallengeUpdate(),
        await commitments[1].getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    return this.sendContractTransaction(tx);
  };

  private setOutcome = async (
    appIdentityHash: string,
    multisigAddress: string,
  ): Promise<providers.TransactionResponse> => {
    const challenge = await this.store.getAppChallenge(appIdentityHash);
    if (!challenge) {
      throw new Error(`No record of challenge found, cannot set outcome`);
    }
    const app = (await this.store.getAppInstance(appIdentityHash)) as AppInstanceJson;
    if (!app) throw new Error(`Can't find app with identity hash: ${appIdentityHash}`);
    // FIXME: assumes that the `app` in the store will be updated
    // from state transitions that result from the game being played out
    // onchain. currently the watcher service CANNOT do this because the
    // service does not have access to "update" store methods
    if (!toBN(challenge.versionNumber).eq(toBN((app as any).versionNumber))) {
      throw new Error(`App is not up to date with onchain challenges, cannot setOutcome`);
    }
    const state = utils.defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const iface = new utils.Interface(ChallengeRegistry.abi);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: iface.encodeFunctionData(iface.getFunction("setOutcome"), [
        this.getAppIdentity(app, multisigAddress),
        state,
      ]),
    };
    return this.sendContractTransaction(tx);
  };

  private cancelChallenge = async (
    channel: StateChannelJSON,
    app: AppInstanceJson,
    req: SignedCancelChallengeRequest,
  ): Promise<providers.TransactionResponse> => {
    const iface = new utils.Interface(this.context.ChallengeRegistry);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: iface.encodeFunctionData(iface.getFunction("cancelChallenge"), [
        this.getAppIdentity(app, channel.multisigAddress),
        req,
      ]),
    };
    return this.sendContractTransaction(tx);
  };

  private getChallenge = async (appInstanceId: string): Promise<AppChallenge> => {
    const [
      status,
      appStateHash,
      versionNumber,
      finalizesAt,
    ] = await this.challengeRegistry.functions.getAppChallenge(appInstanceId);
    return {
      status,
      appStateHash,
      versionNumber,
      finalizesAt,
    };
  };

  //////// Private helper functions
  private sendContractTransaction = async (
    transaction: MinimalTransaction,
  ): Promise<providers.TransactionResponse> => {
    this.assertSignerCanSendTransactions();

    // TODO: add retry logic
    const tx = await this.signer.sendTransaction({
      ...transaction,
      nonce: await this.provider.getTransactionCount(this.signer.address),
    });
    await tx.wait();
    this.log.debug(`Successfully sent transaction ${tx.hash}`);
    return tx;
  };

  private assertSignerCanSendTransactions = (): void => {
    if (!this.signer.provider) {
      throw new Error(`Signer cannot send transactions without an attached provider`);
    }
  };

  private getAppIdentity = (app: AppInstanceJson, multisigAddress: string): AppIdentity => {
    return {
      channelNonce: toBN(app.appSeqNo),
      participants: [
        getSignerAddressFromPublicIdentifier(app.initiatorIdentifier),
        getSignerAddressFromPublicIdentifier(app.responderIdentifier),
      ],
      multisigAddress,
      appDefinition: app.appInterface.addr,
      defaultTimeout: toBN(app.defaultTimeout),
    };
  };
}
