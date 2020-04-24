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
  ChallengeUpdatedEventPayload,
  StateProgressedEventPayload,
  ChallengeStatus,
  StoredAppChallenge,
} from "@connext/types";
import {
  ConsoleLogger,
  ChannelSigner,
  getSignerAddressFromPublicIdentifier,
  nullLogger,
  toBN,
  stringify,
} from "@connext/utils";
import { JsonRpcProvider, TransactionResponse } from "ethers/providers";
import EventEmitter from "eventemitter3";
import { Contract } from "ethers";
import { Interface, BigNumber, defaultAbiCoder } from "ethers/utils";

import { ChainListener } from "./chainListener";
import { Zero, HashZero } from "ethers/constants";

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
    private readonly provider: JsonRpcProvider,
    private readonly context: NetworkContext,
    private readonly store: IWatcherStoreService,
    private readonly listener: ChainListener,
    log: ILoggerService,
  ) {
    this.emitter = new EventEmitter();
    this.log = log.newContext("Watcher");
    this.challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi as any,
      this.provider,
    );
  }

  /////////////////////////////////////
  //// Static methods

  // used to create a new watcher instance from the passed
  // in options (which are cast to the proper values)
  public static init = async (opts: WatcherInitOptions): Promise<Watcher> => {
    const {
      logger,
      logLevel,
      signer: providedSigner,
      provider: ethProvider,
      context,
      store,
    } = opts;

    const log =
      logger && typeof (logger as ILoggerService).newContext === "function"
        ? (logger as ILoggerService).newContext("WatcherInit")
        : logger
        ? new ConsoleLogger("WatcherInit", logLevel, logger)
        : nullLogger;

    log.debug(`Creating new Watcher`);

    const provider =
      typeof ethProvider === "string" ? new JsonRpcProvider(ethProvider) : ethProvider;

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
  public initiate = async (appInstanceId: string): Promise<TransactionResponse | undefined> => {
    this.log.info(`Initiating challenge of ${appInstanceId}`);
    const challenge = (await this.store.getAppChallenge(appInstanceId)) || {
      identityHash: appInstanceId,
      appStateHash: HashZero,
      versionNumber: Zero,
      finalizesAt: Zero,
      status: ChallengeStatus.NO_CHALLENGE,
    };
    const tx = await this.respondToChallenge(challenge);
    if (!tx) {
      throw new Error(`Could not initiate challenge for ${appInstanceId}`);
    }
    this.log.info(`Challenge initiated with: ${tx.hash}`);
    return tx;
  };

  public cancel = async (
    appInstanceId: string,
    req: SignedCancelChallengeRequest,
  ): Promise<TransactionResponse> => {
    this.log.info(`Cancelling challenge for ${appInstanceId}`);
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    const app = await this.store.getAppInstance(appInstanceId);
    if (!app || !channel) {
      throw new Error(`Could not find channel/app for app id: ${appInstanceId}`);
    }
    const tx = await this.cancelChallenge(channel, app, req);
    this.log.info(`Challenge cancelled with: ${tx.hash}`);
    return tx;
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
      await this.catchupFrom(previous);
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
    this.log.debug(`Registering callback for ${event}`);
    this.emitter.on(event, callback);
  }

  public once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void {
    this.log.debug(`Registering callback for ${event}`);
    this.emitter.once(event, callback);
  }

  public removeListener<T extends WatcherEvent>(event: T): void {
    this.log.debug(`Removing callback for ${event}`);
    this.emitter.removeListener(event);
  }

  public removeAllListeners(): void {
    this.log.debug(`Removing all listeners`);
    this.emitter.removeAllListeners();
  }

  /////////////////////////////////////
  //////// Private methods
  // will insert + respond to any events that have occurred from
  // the latest processed block to the provided block
  private catchupFrom = async (blockNumber: number): Promise<void> => {
    this.log.info(`Processing events from ${blockNumber}`);
    const latest = await this.store.getLatestProcessedBlock();
    if (latest > blockNumber) {
      this.log.debug(`Already processed events up to block ${latest}`);
      return;
    }

    // ensure events will not be processed twice
    if (this.enabled) {
      throw new Error(
        `Cannot process past events while listener is still active, call 'disable', then 'enable'`,
      );
    }

    // have listener process and emit all events from block --> now
    await this.registerListeners();
    await this.listener.parseLogsFrom(blockNumber);
    await this.store.updateLatestProcessedBlock(blockNumber);
    this.log.info(
      `Caught up to current ${await this.provider.getBlockNumber()} from ${blockNumber}`,
    );
  };

  // should check every block for challenges that should be advanced,
  // and respond to any listener emitted chain events
  private registerListeners = async (): Promise<void> => {
    this.listener.on(
      ChallengeEvents.ChallengeUpdated,
      async (event: ChallengeUpdatedEventPayload) => {
        await this.processChallengeUpdated(event);
      },
    );
    this.listener.on(
      ChallengeEvents.StateProgressed,
      async (event: StateProgressedEventPayload) => {
        // add events to store + process
        await this.processStateProgressed(event);
      },
    );
    // this.provider.on("block", async (blockNumber: number) => {
    //   await this.advanceDisputes();
    // });
  };

  private processStateProgressed = async (event: StateProgressedEventPayload) => {
    throw new Error("Method not implemented");
  };

  private processChallengeUpdated = async (event: ChallengeUpdatedEventPayload) => {
    this.log.info(`Processing challenge updated event: ${stringify(event)}`);
    await this.store.saveAppChallenge(event);
    const challenge = await this.store.getAppChallenge(event.identityHash);
    return this.respondToChallenge(challenge!);
  };

  private respondToChallenge = async (
    challenge: StoredAppChallenge,
  ): Promise<TransactionResponse | undefined> => {
    this.log.info(`Respond to challenge called with: ${challenge}`);
    const current = await this.provider.getBlockNumber();
    let tx;
    if (challenge.finalizesAt.lte(current) && !challenge.finalizesAt.isZero()) {
      this.log.debug(
        `Challenge timeout elapsed (finalizesAt: ${challenge.finalizesAt.toString()}, current: ${current})`,
      );
      tx = await this.respondToChallengeAfterTimeout(challenge!);
    }
    this.log.debug(
      `Challenge timeout not elapsed or 0 (finalizesAt: ${challenge.finalizesAt.toString()}, current: ${current})`,
    );
    tx = await this.respondToChallengeDuringTimeout(challenge!);
    this.log.info(
      !!tx ? `Could not respond to challenge` : `Responded to challenge with tx: ${tx.hash}`,
    );
    return tx;
  };

  // takes in a challenge and advances it if possible based on the set state
  // commitments available in the store. this function will error if the dispute
  // must be advanced to a different state (ie a timeout has elapsed), and
  // should only be used to progress a challenge
  private respondToChallengeDuringTimeout = async (
    challenge: StoredAppChallenge,
  ): Promise<TransactionResponse | undefined> => {
    const { identityHash, finalizesAt, versionNumber, status } = challenge;
    if (status === ChallengeStatus.OUTCOME_SET || status === ChallengeStatus.EXPLICITLY_FINALIZED) {
      throw new Error(
        `Challenge is in the wrong status for response during timeout: ${stringify(challenge)}`,
      );
    }
    const current = await this.provider.getBlockNumber();
    if (finalizesAt.lte(current) && !finalizesAt.isZero()) {
      this.log.info(
        `Response period for challenge has elapsed (curr: ${current}, finalized: ${finalizesAt.toString()}). App: ${identityHash}`,
      );
      return undefined;
    }
    const setStates = (await this.store.getSetStateCommitments(identityHash)).sort((a, b) =>
      toBN(b.versionNumber).sub(a.versionNumber._hex).toNumber(),
    );
    const latest = { ...setStates[0] };
    const prev = { ...setStates[1] };
    if (versionNumber.gte(latest.versionNumber._hex)) {
      // no actions available
      this.log.info(
        `Latest set-state commitment version number is the same as challenge version number, doing nothing`,
      );
      return undefined;
    }

    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }
    const validAction = !!app.latestAction && latest.signatures.filter((x) => !!x).length === 1;
    const validPrev =
      prev &&
      prev.signatures.filter((x) => !!x).length === 2 &&
      toBN(prev.versionNumber._hex).eq(toBN(latest.versionNumber._hex).add(1));

    let disputeTx;
    if (Zero.eq(latest.stateTimeout._hex) && validAction && validPrev) {
      disputeTx = await this.setAndProgressState(identityHash, channel.multisigAddress);
    } else if (status === ChallengeStatus.IN_ONCHAIN_PROGRESSION && validAction) {
      // use progressState IFF:
      disputeTx = await this.progressState(identityHash, channel.multisigAddress);
    } else {
      // otherwise, use set state
      disputeTx = await this.setState(identityHash, toBN(latest.versionNumber));
    }
    return disputeTx;
  };

  // should advance (call `setOutcome`, `progressState`, etc.) any active
  // disputes with an elapsed timeout
  private respondToChallengeAfterTimeout = async (
    challenge: StoredAppChallenge,
  ): Promise<TransactionResponse | undefined> => {
    const { identityHash, status } = challenge;
    if (status === ChallengeStatus.OUTCOME_SET || status === ChallengeStatus.NO_CHALLENGE) {
      throw new Error(
        `Challenge is in the wrong status for response after timeout: ${stringify(challenge)}`,
      );
    }
    const current = await this.provider.getBlockNumber();
    if (challenge.finalizesAt.gt(current)) {
      this.log.info(
        `Response period for challenge has not yet elapsed (curr: ${current}, finalized: ${challenge.finalizesAt.toString()}). App: ${identityHash}`,
      );
      return undefined;
    }
    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }
    // if challenge is explicitly finalized, call set outcome
    if (status === ChallengeStatus.EXPLICITLY_FINALIZED) {
      return this.setOutcome(identityHash, channel?.multisigAddress);
    }
    // if there is a valid action to play, and the challenge is leaving the
    // in dispute/onchain phase, call `progressState`
    const nextCommitment = (await this.store.getSetStateCommitments(identityHash)).find((c) =>
      toBN(c.versionNumber).eq(challenge.versionNumber.add(1)),
    );
    if (!nextCommitment) {
      throw new Error(`Could not find commitment at nonce n + 1, cannot call progress state`);
    }
    const validStatus =
      status === ChallengeStatus.IN_DISPUTE || status === ChallengeStatus.IN_ONCHAIN_PROGRESSION;
    const validAction =
      !!app.latestAction && nextCommitment.signatures.filter((x) => !!x).length === 1;
    if (nextCommitment && validAction && validStatus) {
      return this.progressState(identityHash, channel.multisigAddress);
    }
    this.log.info(`Could not advance dispute for app ${identityHash}`);
    return undefined;
  };

  //////// Private contract methods
  private setState = async (
    appIdentityHash: string,
    versionNumber: BigNumber,
  ): Promise<TransactionResponse> => {
    this.log.info(`Calling 'setState' for ${appIdentityHash} at nonce ${versionNumber.toString()}`);
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitment = SetStateCommitment.fromJson(
      jsons.filter((x) => toBN(x.versionNumber).eq(toBN(versionNumber)))[0],
    );
    return this.sendContractTransaction(await commitment.getSignedTransaction());
  };

  private sendConditionalTransaction = async (
    appIdentityHash: string,
  ): Promise<TransactionResponse> => {
    this.log.info(`Sending conditional transaction for ${appIdentityHash}`);
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
  ): Promise<TransactionResponse> => {
    this.log.info(`Calling 'progressState' for ${appIdentityHash}`);
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitments = jsons
      .sort((a, b) => toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber())
      .map(SetStateCommitment.fromJson);

    const app = (await this.store.getAppInstance(appIdentityHash)) as AppInstanceJson;
    if (!app) throw new Error(`Can't find app with identity hash: ${appIdentityHash}`);
    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);

    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi as any).functions.progressState.encode([
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
  ): Promise<TransactionResponse> => {
    this.log.info(`Calling 'setAndProgressState' for ${appIdentityHash}`);
    const jsons = await this.store.getSetStateCommitments(appIdentityHash);
    const commitments = jsons
      .sort((a, b) => toBN(a.versionNumber).sub(toBN(b.versionNumber)).toNumber())
      .map(SetStateCommitment.fromJson);

    const app = (await this.store.getAppInstance(appIdentityHash)) as AppInstanceJson;
    if (!app) throw new Error(`Can't find app with identity hash: ${appIdentityHash}`);
    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi as any).functions.setAndProgressState.encode([
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
  ): Promise<TransactionResponse> => {
    this.log.info(`Calling 'setOutcome' for ${appIdentityHash}`);
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
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi as any).functions.setOutcome.encode([
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
  ): Promise<TransactionResponse> => {
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(this.context.ChallengeRegistry).functions.cancelChallenge.encode([
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
  ): Promise<TransactionResponse> => {
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
