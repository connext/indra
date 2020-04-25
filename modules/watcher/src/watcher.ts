import {
  ChallengeRegistry,
  ConditionalTransactionCommitment,
  SetStateCommitment,
} from "@connext/contracts";
import {
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
  StoredAppChallenge,
  SetStateCommitmentJSON,
  WatcherEvents,
  StoredAppChallengeStatus,
  ConditionalTransactionCommitmentJSON,
  ChallengeInitiatedResponse,
} from "@connext/types";
import {
  ConsoleLogger,
  ChannelSigner,
  getSignerAddressFromPublicIdentifier,
  nullLogger,
  toBN,
  stringify,
  bigNumberifyJson,
} from "@connext/utils";
import { JsonRpcProvider, TransactionReceipt } from "ethers/providers";
import EventEmitter from "eventemitter3";
import { Contract } from "ethers";
import { Interface, defaultAbiCoder } from "ethers/utils";

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
  public initiate = async (appInstanceId: string): Promise<ChallengeInitiatedResponse> => {
    this.log.info(`Initiating challenge of ${appInstanceId}`);
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    if (!channel || !channel.freeBalanceAppInstance) {
      throw new Error(`Could not find channel with free balance for app ${appInstanceId}`);
    }
    const freeBalanceId = channel.freeBalanceAppInstance.identityHash;
    this.log.info(`Initiating challenge for free balance ${freeBalanceId}`);
    const freeBalanceRes = await this.startAppChallenge(freeBalanceId);
    this.log.debug(`Dispute of free balance started, tx: ${freeBalanceRes.transactionHash}`);
    const appRes = await this.startAppChallenge(appInstanceId);
    this.log.debug(`Dispute of app started, tx: ${appRes.transactionHash}`);
    return {
      freeBalanceChallenge: freeBalanceRes,
      appChallenge: appRes,
    };
  };

  public cancel = async (
    appInstanceId: string,
    req: SignedCancelChallengeRequest,
  ): Promise<TransactionReceipt> => {
    this.log.info(`Cancelling challenge for ${appInstanceId}`);
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    const app = await this.store.getAppInstance(appInstanceId);
    const challenge = await this.store.getAppChallenge(appInstanceId);
    if (!app || !channel || !challenge) {
      throw new Error(`Could not find channel/app for app id: ${appInstanceId}`);
    }
    const response = await this.cancelChallenge(app, channel, req);
    if (typeof response === "string") {
      throw new Error(`Could not cancel challenge for ${appInstanceId}. ${response}`);
    }
    this.log.info(`Challenge cancelled with: ${response.transactionHash}`);
    return response;
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
    const current = await this.provider.getBlockNumber();
    const starting = latest > blockNumber ? latest : blockNumber;
    if (starting > current) {
      throw new Error(`Cannot process future blocks (current: ${current}, starting: ${starting})`);
    }

    // ensure events will not be processed twice
    if (this.enabled) {
      throw new Error(
        `Cannot process past events while listener is still active, call 'disable', then 'enable'`,
      );
    }

    // have listener process and emit all events from block --> now
    this.registerListeners();
    await this.listener.parseLogsFrom(starting);
    await this.store.updateLatestProcessedBlock(current);
    // cleanup any listeners
    this.removeListeners();
    this.log.info(`Caught up to with events in blocks ${starting} - ${current} from ${latest}`);
  };

  // should check every block for challenges that should be advanced,
  // and respond to any listener emitted chain events
  private registerListeners = () => {
    this.listener.on(
      ChallengeEvents.ChallengeUpdated,
      async (event: ChallengeUpdatedEventPayload) => {
        await this.processChallengeUpdated(event);
        // parrot listener event
        this.emit(WatcherEvents.ChallengeUpdatedEvent, event);
      },
    );
    this.listener.on(
      ChallengeEvents.StateProgressed,
      async (event: StateProgressedEventPayload) => {
        // add events to store + process
        await this.processStateProgressed(event);
        this.emit(WatcherEvents.StateProgressedEvent, event);
      },
    );
    this.provider.on("block", async (blockNumber: number) => {
      await this.advanceDisputes();
      await this.store.updateLatestProcessedBlock(blockNumber);
    });
  };

  private removeListeners = () => {
    this.listener.removeAllListeners();
    this.provider.removeAllListeners();
  };

  private startAppChallenge = async (appInstanceId: string): Promise<TransactionReceipt> => {
    this.log.debug(`Starting challenge for ${appInstanceId}`);
    const challenge = (await this.store.getAppChallenge(appInstanceId)) || {
      identityHash: appInstanceId,
      appStateHash: HashZero,
      versionNumber: Zero,
      finalizesAt: Zero,
      status: StoredAppChallengeStatus.NO_CHALLENGE,
    };
    const response = await this.respondToChallenge(challenge);
    if (typeof response === "string") {
      throw new Error(`Could not initiate challenge for ${appInstanceId}. ${response}`);
    }
    this.log.info(`Challenge initiated with: ${response.transactionHash}`);
    return response;
  };

  private advanceDisputes = async () => {
    const active = (await this.store.getActiveChallenges()).filter(
      (c) => c.status !== StoredAppChallengeStatus.PENDING_TRANSITION,
    );
    this.log.info(`Found ${active.length} active challenges`);
    for (const challenge of active) {
      this.log.debug(`Advancing ${challenge.identityHash} dispute`);
      try {
        const response = await this.respondToChallenge(challenge);
        if (typeof response === "string") {
          this.log.info(response);
          continue;
        }
      } catch (e) {
        this.log.warn(
          `Failed to respond to challenge: ${e.stack || e.message}. Challenge: ${stringify(
            challenge,
          )}`,
        );
      }
    }
  };

  private processStateProgressed = async (event: StateProgressedEventPayload) => {
    throw new Error("Method not implemented");
  };

  private processChallengeUpdated = async (event: ChallengeUpdatedEventPayload) => {
    this.log.info(`Processing challenge updated event: ${stringify(event)}`);
    await this.store.saveAppChallenge(event);
    const challenge = await this.store.getAppChallenge(event.identityHash);
    this.log.debug(`Saved challenge to store: ${stringify(challenge)}`);
  };

  private respondToChallenge = async (
    challengeJson: StoredAppChallenge,
  ): Promise<TransactionReceipt | string> => {
    this.log.info(`Respond to challenge called with: ${stringify(challengeJson)}`);
    const challenge = bigNumberifyJson(challengeJson);
    const current = await this.provider.getBlockNumber();
    let tx;
    if (challenge.finalizesAt.lte(current) && !challenge.finalizesAt.isZero()) {
      this.log.debug(
        `Challenge timeout elapsed (finalizesAt: ${challenge.finalizesAt.toString()}, current: ${current})`,
      );
      tx = await this.respondToChallengeAfterTimeout(challenge!);
    } else {
      this.log.debug(
        `Challenge timeout not elapsed or 0 (finalizesAt: ${challenge.finalizesAt.toString()}, current: ${current})`,
      );
      tx = await this.respondToChallengeDuringTimeout(challenge!);
    }
    return tx;
  };

  // takes in a challenge and advances it if possible based on the set state
  // commitments available in the store. this function will error if the dispute
  // must be advanced to a different state (ie a timeout has elapsed), and
  // should only be used to progress a challenge
  private respondToChallengeDuringTimeout = async (
    challenge: StoredAppChallenge,
  ): Promise<TransactionReceipt | string> => {
    const { identityHash, finalizesAt, versionNumber, status } = challenge;
    // check that timeout of challenge is active
    const current = await this.provider.getBlockNumber();
    if (finalizesAt.lte(current) && !finalizesAt.isZero()) {
      const msg = `Response period for challenge has elapsed (curr: ${current}, finalized: ${finalizesAt.toString()}). App: ${identityHash}`;
      this.log.info(msg);
      return msg;
    }

    // sort existing set state commitments by version number
    const [latest, prev] = (await this.store.getSetStateCommitments(identityHash)).sort((a, b) =>
      toBN(b.versionNumber).sub(a.versionNumber._hex).toNumber(),
    );

    // make sure that challenge is up to date with our commitments
    if (versionNumber.gte(latest.versionNumber._hex)) {
      // no actions available
      const msg = `Latest set-state commitment version number is the same as challenge version number, doing nothing`;
      return msg;
    }

    // update active challenge
    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }
    const canProgressState =
      !!app.latestAction && latest.signatures.filter((x) => !!x).length === 1;
    const canSetPreviousState =
      !!prev &&
      prev.signatures.filter((x) => !!x).length === 2 &&
      toBN(prev.versionNumber._hex).eq(toBN(latest.versionNumber._hex).sub(1));
    const canImmediatelyProgress =
      canProgressState && canSetPreviousState && toBN(latest.stateTimeout).isZero();

    switch (status) {
      case StoredAppChallengeStatus.NO_CHALLENGE: {
        if (canImmediatelyProgress) {
          this.log.debug(`Calling set and progress state for challenge`);
          return this.setAndProgressState(app, channel, challenge, [latest, prev]);
        } else {
          this.log.debug(`Calling set state for challenge`);
          return this.setState(app, channel, challenge, latest);
        }
      }
      case StoredAppChallengeStatus.IN_DISPUTE: {
        if (canImmediatelyProgress) {
          this.log.debug(`Calling set and progress state for challenge`);
          return this.setAndProgressState(app, channel, challenge, [latest, prev]);
        } else if (canProgressState) {
          this.log.debug(`Calling progress state for challenge`);
          return this.progressState(app, channel, [latest, prev]);
        } else {
          this.log.debug(`Calling set state for challenge`);
          return this.setState(app, channel, challenge, latest);
        }
      }
      case StoredAppChallengeStatus.IN_ONCHAIN_PROGRESSION: {
        if (canProgressState) {
          this.log.debug(`Calling progress state for challenge`);
          return this.progressState(app, channel, [latest, prev]);
        }
        return `Can not progress challenge, must wait out timeout. Challenge: ${stringify(
          challenge,
        )}`;
      }
      case StoredAppChallengeStatus.EXPLICITLY_FINALIZED:
      case StoredAppChallengeStatus.OUTCOME_SET:
      case StoredAppChallengeStatus.CONDITIONAL_SENT: {
        throw new Error(
          `Challenge is in the wrong status for response during timeout: ${stringify(challenge)}`,
        );
      }
      case StoredAppChallengeStatus.PENDING_TRANSITION: {
        const msg = `Challenge has pending transaction, waiting to resolve before responding`;
        this.log.debug(msg);
        return msg;
      }
      default: {
        throw new Error(`Unrecognized challenge status. Challenge: ${stringify(challenge)}`);
      }
    }
  };

  // should advance (call `setOutcome`, `progressState`, etc.) any active
  // disputes with an elapsed timeout
  private respondToChallengeAfterTimeout = async (
    challenge: StoredAppChallenge,
  ): Promise<TransactionReceipt | string> => {
    const { identityHash, status } = challenge;
    // ensure timeout expired
    const current = await this.provider.getBlockNumber();
    if (challenge.finalizesAt.gt(current)) {
      const msg = `Response period for challenge has not yet elapsed (curr: ${current}, finalized: ${challenge.finalizesAt.toString()}). App: ${identityHash}`;
      this.log.info(msg);
      return msg;
    }

    // verify app and channel records
    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }

    switch (status) {
      case StoredAppChallengeStatus.NO_CHALLENGE: {
        throw new Error(
          `Timed out challenge should never have a no challenge status. Challenge: ${stringify(
            challenge,
          )}`,
        );
      }
      case StoredAppChallengeStatus.IN_DISPUTE: {
        // check if there is a valid action to play
        const next = (await this.store.getSetStateCommitments(identityHash)).find((c) =>
          toBN(c.versionNumber).eq(challenge.versionNumber.add(1)),
        );
        const prev = (await this.store.getSetStateCommitments(identityHash)).find((c) =>
          toBN(c.versionNumber).eq(challenge.versionNumber),
        );
        if (!prev) {
          throw new Error(`Could not find commitment for ${challenge.versionNumber.toString()}`);
        }
        const validCommitment = !!next && next.signatures.filter((x) => !!x).length === 1;
        if (validCommitment && !!app.latestAction) {
          this.log.info(
            `Onchain state set, progressing to nonce ${challenge.versionNumber.add(1).toString()}`,
          );
          return this.progressState(app, channel, [prev, next!]);
        } else {
          // check if you can set outcome
          if (challenge.finalizesAt.add(app.defaultTimeout).gt(current)) {
            const msg = `No action found, cannot yet call set outcome (current: ${current}, outcome settable: ${challenge.finalizesAt.add(
              app.defaultTimeout,
            )})`;
            this.log.info(msg);
            return msg;
          }
          this.log.info(`Onchain state finalized, no actions to progress, setting outcome`);
          return this.setOutcome(app, channel);
        }
      }
      case StoredAppChallengeStatus.IN_ONCHAIN_PROGRESSION: {
        this.log.info(`Onchain progression finalized, setting outcome`);
        return this.setOutcome(app, channel);
      }
      case StoredAppChallengeStatus.EXPLICITLY_FINALIZED: {
        this.log.info(`Challenge explicitly finalized, setting outcome`);
        return this.setOutcome(app, channel);
      }
      case StoredAppChallengeStatus.OUTCOME_SET: {
        this.log.info(`Sending conditional transaction`);
        return `tried to send conditional tx`; // this.sendConditionalTransaction(identityHash);
      }
      case StoredAppChallengeStatus.CONDITIONAL_SENT: {
        const msg = `Conditional transaction for challenge has already been sent. App: ${identityHash}`;
        this.log.info(msg);
        return msg;
      }
      case StoredAppChallengeStatus.PENDING_TRANSITION: {
        const msg = `Challenge has pending transaction, waiting to resolve before responding`;
        this.log.debug(msg);
        return msg;
      }
      default: {
        throw new Error(`Unrecognized challenge status. Challenge: ${stringify(challenge)}`);
      }
    }
  };

  //////// Private contract methods
  private setState = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    challenge: StoredAppChallenge,
    setStateCommitment: SetStateCommitmentJSON,
  ): Promise<TransactionReceipt | string> => {
    this.log.info(
      `Calling 'setState' for ${setStateCommitment.appIdentityHash} at nonce ${toBN(
        setStateCommitment.versionNumber,
      ).toString()}`,
    );
    this.log.debug(`Setting state with commitment: ${stringify(setStateCommitment)}`);
    const commitment = SetStateCommitment.fromJson(setStateCommitment);
    const response = await this.sendContractTransaction(
      await commitment.getSignedTransaction(),
      challenge,
    );
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeProgressionFailedEvent, {
        appInstanceId: commitment.appIdentityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { setStateCommitment, app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeProgressedEvent, {
        appInstanceId: commitment.appIdentityHash,
        transaction: response,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  private sendConditionalTransaction = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    conditional: ConditionalTransactionCommitmentJSON,
  ): Promise<TransactionReceipt | string> => {
    this.log.info(`Sending conditional transaction for ${app.identityHash}`);
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    const commitment = ConditionalTransactionCommitment.fromJson(conditional);
    const response = await this.sendContractTransaction(
      commitment.getTransactionDetails(),
      challenge,
    );
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeCompletionFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { conditional, app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeCompletedEvent, {
        appInstanceId: app.identityHash,
        transaction: response as TransactionReceipt,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  private progressState = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    sortedCommitments: SetStateCommitmentJSON[],
  ): Promise<TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.info(
      `Calling 'progressState' for ${app.identityHash} at currrent nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );
    const commitments = sortedCommitments.map(SetStateCommitment.fromJson);

    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);

    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi as any).functions.progressState.encode([
        this.getAppIdentity(app, channel.multisigAddress),
        await commitments[0].getSignedAppChallengeUpdate(),
        await commitments[1].getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    const response = await this.sendContractTransaction(tx, challenge);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeProgressionFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { commitments, app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeProgressedEvent, {
        appInstanceId: app.identityHash,
        transaction: response,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  private setAndProgressState = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    challenge: StoredAppChallenge,
    sortedCommitments: SetStateCommitmentJSON[],
  ): Promise<TransactionReceipt | string> => {
    this.log.info(
      `Calling 'setAndProgressState' for ${app.identityHash} at currrent nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );
    const commitments = sortedCommitments.map(SetStateCommitment.fromJson);

    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi as any).functions.setAndProgressState.encode([
        this.getAppIdentity(app, channel.multisigAddress),
        await commitments[0].getSignedAppChallengeUpdate(),
        await commitments[1].getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    const response = await this.sendContractTransaction(tx, challenge);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeProgressionFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { commitments, app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeProgressedEvent, {
        appInstanceId: app.identityHash,
        transaction: response,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  private setOutcome = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
  ): Promise<TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.info(
      `Calling 'setOutcome' for ${app.identityHash} at nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );

    // FIXME: assumes that the `app` in the store will be updated
    // from state transitions that result from the game being played out
    // onchain. currently the watcher service CANNOT do this because the
    // service does not have access to "update" store methods
    if (!toBN(challenge.versionNumber).eq(toBN(app.latestVersionNumber))) {
      throw new Error(`App is not up to date with onchain challenges, cannot setOutcome`);
    }
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi).functions.setOutcome.encode([
        this.getAppIdentity(app, channel.multisigAddress),
        state,
      ]),
    };
    const response = await this.sendContractTransaction(tx, challenge);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeOutcomeFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeOutcomeSetEvent, {
        appInstanceId: app.identityHash,
        transaction: response,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  private cancelChallenge = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    req: SignedCancelChallengeRequest,
  ): Promise<TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.info(
      `Calling 'cancelChallenge' for ${app.identityHash} at nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(this.context.ChallengeRegistry).functions.cancelChallenge.encode([
        this.getAppIdentity(app, channel.multisigAddress),
        req,
      ]),
    };
    const response = await this.sendContractTransaction(tx, challenge);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeCancellationFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { req, app, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeCancelledEvent, {
        appInstanceId: app.identityHash,
        transaction: response,
        multisigAddress: channel.multisigAddress,
      });
    }
    return response;
  };

  //////// Private helper functions
  private sendContractTransaction = async (
    transaction: MinimalTransaction,
    challenge: StoredAppChallenge,
  ): Promise<TransactionReceipt | string> => {
    this.assertSignerCanSendTransactions();

    // TODO: add retry logic
    let response;
    try {
      await this.store.saveAppChallenge({
        ...challenge,
        status: StoredAppChallengeStatus.PENDING_TRANSITION,
      });
      response = await this.signer.sendTransaction({
        ...transaction,
        nonce: await this.provider.getTransactionCount(this.signer.address),
      });
      const receipt = await response.wait();
      this.log.debug(`Transaction sent: ${stringify(receipt)}`);
      this.log.info(`Successfully sent transaction ${receipt.transactionHash}`);
      return receipt;
    } catch (e) {
      // remove transition status
      await this.store.saveAppChallenge(challenge);
      this.log.error(`Failed to send transaction: ${e.stack || e.message}`);
      const msg = `Error sending transaction: ${
        e.stack || e.message
      }, transaction response: ${stringify(response || {})}`;
      return msg;
    }
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

  private getChallengeOrThrow = async (identityHash: string): Promise<StoredAppChallenge> => {
    const challenge = await this.store.getAppChallenge(identityHash);
    if (!challenge) {
      throw new Error(`Could not find challenge for app ${identityHash}`);
    }
    return challenge;
  };
}
