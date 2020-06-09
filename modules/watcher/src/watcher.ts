import {
  ChallengeRegistry,
  ConditionalTransactionCommitment,
  SetStateCommitment,
  CounterfactualApp,
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
import EventEmitter from "eventemitter3";
import { Contract, providers, constants, utils } from "ethers";

import { ChainListener } from "./chainListener";

const { Zero, HashZero } = constants;
const { Interface, defaultAbiCoder } = utils;

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
  public initiate = async (appInstanceId: string): Promise<ChallengeInitiatedResponse> => {
    this.log.info(`Initiating challenge of ${appInstanceId}`);
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    if (!channel || !channel.freeBalanceAppInstance) {
      throw new Error(`Could not find channel with free balance for app ${appInstanceId}`);
    }
    const freeBalanceId = channel.freeBalanceAppInstance.identityHash;
    this.log.info(`Initiating challenge for free balance ${freeBalanceId}`);
    const freeBalanceChallenge = await this.startAppChallenge(freeBalanceId);
    this.log.debug(`Dispute of free balance started, tx: ${freeBalanceChallenge.transactionHash}`);
    const appChallenge = await this.startAppChallenge(appInstanceId);
    this.log.debug(`Dispute of app started, tx: ${appChallenge.transactionHash}`);
    return {
      freeBalanceChallenge,
      appChallenge,
    };
  };

  public cancel = async (
    appInstanceId: string,
    req: SignedCancelChallengeRequest,
  ): Promise<providers.TransactionReceipt> => {
    this.log.info(
      `Cancelling challenge for ${appInstanceId} at nonce ${toBN(req.versionNumber).toString()}`,
    );
    const channel = await this.store.getStateChannelByAppIdentityHash(appInstanceId);
    const app = await this.store.getAppInstance(appInstanceId);
    if (!app || !channel) {
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
    this.registerListeners();

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

  private startAppChallenge = async (
    appInstanceId: string,
  ): Promise<providers.TransactionReceipt> => {
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
    this.log.info(`Found ${active.length} active challenges: ${stringify(active)}`);
    for (const challenge of active) {
      await this.updateChallengeStatus(StoredAppChallengeStatus.PENDING_TRANSITION, challenge);
      this.log.debug(`Advancing ${challenge.identityHash} dispute`);
      try {
        const response = await this.respondToChallenge(challenge);
        if (typeof response === "string") {
          this.log.info(response);
          // something went wrong, remove pending status
          await this.updateChallengeStatus(challenge.status, challenge);
          continue;
        }
      } catch (e) {
        // something went wrong, remove pending status
        await this.updateChallengeStatus(challenge.status, challenge);
        this.log.warn(
          `Failed to respond to challenge: ${e.stack || e.message}. Challenge: ${stringify(
            challenge,
          )}`,
        );
      }
    }
  };

  private processStateProgressed = async (event: StateProgressedEventPayload) => {
    this.log.info(`Processing state progressed event: ${stringify(event)}`);
    await this.store.createStateProgressedEvent(event);
    this.log.debug(`Saved event to store, adding action to app`);
    await this.store.addOnchainAction(event.identityHash, this.provider);
    const app = await this.store.getAppInstance(event.identityHash);
    this.log.debug(`Action added, updated app: ${stringify(app)}`);
  };

  private processChallengeUpdated = async (event: ChallengeUpdatedEventPayload) => {
    this.log.info(`Processing challenge updated event: ${stringify(event)}`);
    await this.store.createChallengeUpdatedEvent(event);
    await this.store.saveAppChallenge(event);
    const challenge = await this.store.getAppChallenge(event.identityHash);
    this.log.debug(`Saved challenge to store: ${stringify(challenge)}`);
  };

  private respondToChallenge = async (
    challengeJson: StoredAppChallenge,
  ): Promise<providers.TransactionReceipt | string> => {
    this.log.info(`Respond to challenge called with: ${stringify(challengeJson)}`);
    const challenge = bigNumberifyJson(challengeJson) as StoredAppChallenge;
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
  ): Promise<providers.TransactionReceipt | string> => {
    const { identityHash, versionNumber, status } = challenge;

    // verify app and channel records
    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }

    // make sure that challenge is up to date with our commitments
    if (versionNumber.gte(app.latestVersionNumber)) {
      // no actions available
      const msg = `Latest set-state commitment version number ${toBN(
        app.latestVersionNumber,
      ).toString()} is the same as challenge version number ${versionNumber.toString()}, doing nothing`;
      return msg;
    }

    // get sorted commitments for s0 and s1
    const [latest, prev] = await this.getSortedSetStateCommitments(app.identityHash);

    const canPlayAction = await this.canPlayAction(app, challenge);
    switch (status) {
      case StoredAppChallengeStatus.NO_CHALLENGE: {
        if (canPlayAction) {
          this.log.debug(`Calling set and progress state for challenge`);
          return this.setAndProgressState(app, channel, challenge, [latest, prev]);
        } else if (latest.signatures.filter((x) => !!x).length === 2) {
          this.log.debug(`Calling set state for challenge`);
          return this.setState(app, channel, challenge, latest);
        } else {
          const msg = `No double signed set state commitment found with higher nonce then ${versionNumber.toString()}, doing nothing`;
          this.log.debug(msg);
          return msg;
        }
      }
      case StoredAppChallengeStatus.IN_DISPUTE: {
        if (!canPlayAction) {
          this.log.debug(`Calling set state for challenge`);
          return this.setState(app, channel, challenge, latest);
        }
        // if there is no state to set, but there is an action to play
        // call `progressState`
        if (toBN(prev.versionNumber).eq(challenge.versionNumber)) {
          this.log.debug(`Calling progress state for challenge`);
          return this.progressState(app, channel, [latest, prev]);
        }
        // if there is a state that is set and immediately finalized,
        // call `setAndProgressState`
        if (
          toBN(prev.stateTimeout).isZero() &&
          challenge.versionNumber.lt(prev.versionNumber._hex)
        ) {
          this.log.debug(`Calling set and progress state for challenge`);
          return this.setAndProgressState(app, channel, challenge, [latest, prev]);
        }
        const msg = `Cannot progress challenge, must wait out timeout. Challenge: ${stringify(
          challenge,
        )}`;
        this.log.debug(msg);
        return msg;
      }
      case StoredAppChallengeStatus.IN_ONCHAIN_PROGRESSION: {
        if (canPlayAction) {
          this.log.debug(`Calling progress state for challenge`);
          return this.progressState(app, channel, [latest, prev]);
        }
        return `Cannot progress challenge, must wait out timeout. Challenge: ${stringify(
          challenge,
        )}`;
      }
      case StoredAppChallengeStatus.PENDING_TRANSITION: {
        const msg = `Challenge has pending transaction, waiting to resolve before responding`;
        this.log.debug(msg);
        return msg;
      }
      case StoredAppChallengeStatus.EXPLICITLY_FINALIZED:
      case StoredAppChallengeStatus.OUTCOME_SET:
      case StoredAppChallengeStatus.CONDITIONAL_SENT: {
        throw new Error(
          `Challenge is in the wrong status for response during timeout: ${stringify(challenge)}`,
        );
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
  ): Promise<providers.TransactionReceipt | string> => {
    const { identityHash, status } = challenge;

    // verify app and channel records
    const app = await this.store.getAppInstance(identityHash);
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!app || !channel) {
      throw new Error(`Could not find app or channel in store for app id: ${identityHash}`);
    }

    const canPlayAction = await this.canPlayAction(app, challenge);

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
        if (canPlayAction) {
          this.log.info(
            `Onchain state set, progressing to nonce ${challenge.versionNumber.add(1).toString()}`,
          );
          return this.progressState(
            app,
            channel,
            await this.getSortedSetStateCommitments(app.identityHash),
          );
        } else {
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
        // check that free balance app has been disputed
        const isFreeBalance = await this.isFreeBalanceApp(identityHash);
        if (isFreeBalance) {
          const setup = await this.store.getSetupCommitment(channel.multisigAddress);
          if (!setup) {
            throw new Error(
              `Could not find setup transaction for channel ${channel.multisigAddress}`,
            );
          }
          return this.executeEffectOfFreeBalance(channel, setup);
        }
        const conditional = await this.store.getConditionalTransactionCommitment(identityHash);
        if (!conditional) {
          const msg = `Cannot find conditional transaction for app: ${identityHash}, cannot finalize`;
          this.log.debug(msg);
          return msg;
        }
        this.log.info(`Sending conditional transaction`);
        return this.executeEffectOfInterpretedApp(app, channel, conditional);
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
  ): Promise<providers.TransactionReceipt | string> => {
    this.log.info(
      `Calling 'setState' for ${setStateCommitment.appIdentityHash} at nonce ${toBN(
        setStateCommitment.versionNumber,
      ).toString()}`,
    );
    this.log.debug(`Setting state with commitment: ${stringify(setStateCommitment)}`);
    const commitment = SetStateCommitment.fromJson(setStateCommitment);
    const response = await this.sendContractTransaction(await commitment.getSignedTransaction());
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

  private executeEffectOfFreeBalance = async (
    channel: StateChannelJSON,
    setup: MinimalTransaction,
  ): Promise<providers.TransactionReceipt | string> => {
    // make sure all ssociated apps has already tried to execute its effect
    const appIds = channel.appInstances.map(([id]) => id);
    for (const identityHash of appIds) {
      const challenge = await this.getChallengeOrThrow(identityHash);
      if (challenge.status !== StoredAppChallengeStatus.CONDITIONAL_SENT) {
        const msg = `Make sure all apps have sent conditional transactions before sending free balance`;
        return msg;
      }
    }
    const challenge = await this.getChallengeOrThrow(channel.freeBalanceAppInstance!.identityHash);
    const response = await this.sendContractTransaction(setup);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeCompletionFailedEvent, {
        appInstanceId: channel!.freeBalanceAppInstance!.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { setup, channel },
      });
    } else {
      this.emit(WatcherEvents.ChallengeCompletedEvent, {
        appInstanceId: channel!.freeBalanceAppInstance!.identityHash,
        transaction: response as providers.TransactionReceipt,
        multisigAddress: channel.multisigAddress,
      });
      await this.updateChallengeStatus(StoredAppChallengeStatus.CONDITIONAL_SENT, challenge!);
    }
    return response;
  };

  private executeEffectOfInterpretedApp = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    conditional: ConditionalTransactionCommitmentJSON,
  ): Promise<providers.TransactionReceipt | string> => {
    this.log.info(`Sending conditional transaction for ${app.identityHash}`);
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    const commitment = ConditionalTransactionCommitment.fromJson(conditional);
    const response = await this.sendContractTransaction(await commitment.getSignedTransaction());
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
        transaction: response as providers.TransactionReceipt,
        multisigAddress: channel.multisigAddress,
      });
      // update challenge of app and free balance
      const appChallenge = await this.store.getAppChallenge(app.identityHash);
      await this.updateChallengeStatus(StoredAppChallengeStatus.CONDITIONAL_SENT, appChallenge!);
    }
    return response;
  };

  private progressState = async (
    app: AppInstanceJson,
    channel: StateChannelJSON,
    sortedCommitments: SetStateCommitmentJSON[],
  ): Promise<providers.TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.info(
      `Calling 'progressState' for ${app.identityHash} at currrent nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );
    const [latest] = sortedCommitments.map(SetStateCommitment.fromJson);

    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);

    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi).encodeFunctionData("progressState", [
        this.getAppIdentity(app, channel.multisigAddress),
        await latest.getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    const response = await this.sendContractTransaction(tx);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeProgressionFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { commitments: sortedCommitments, app, channel },
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
  ): Promise<providers.TransactionReceipt | string> => {
    this.log.info(
      `Calling 'setAndProgressState' for ${app.identityHash} with expected final nonce of ${toBN(
        sortedCommitments[0].versionNumber,
      ).toString()}`,
    );
    const [latest, prev] = sortedCommitments.map(SetStateCommitment.fromJson);

    const action = defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]);
    const state = defaultAbiCoder.encode([app.appInterface.stateEncoding], [app.latestState]);
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi).encodeFunctionData("setAndProgressState", [
        this.getAppIdentity(app, channel.multisigAddress),
        await prev.getSignedAppChallengeUpdate(),
        await latest.getSignedAppChallengeUpdate(),
        state,
        action,
      ]),
    };
    const response = await this.sendContractTransaction(tx);
    if (typeof response === "string") {
      this.emit(WatcherEvents.ChallengeProgressionFailedEvent, {
        appInstanceId: app.identityHash,
        error: response,
        multisigAddress: channel.multisigAddress,
        challenge,
        params: { commitments: sortedCommitments, app, channel },
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
  ): Promise<providers.TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.info(
      `Calling 'setOutcome' for ${app.identityHash} at nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );

    // NOTE: The `addOnchainAction` store method does not have the ability to
    // sign any commitments or new states. Instead, the app / set-state
    // commitment will have emitted action / sigs added to it. The channel
    // participants are expected to subscribe to events and update their own
    // apps and commitments if desired. Log a warning if values are out of
    // sync, and proceed to set outcome
    if (!toBN(challenge.versionNumber).eq(toBN(app.latestVersionNumber))) {
      this.log.warn(
        `Stored app is not up to date with onchain challenges, calling set outcome regardless since state is finalized onchain`,
      );
      this.log.debug(`Stored app: ${stringify(app)}`);
    }

    // derive final state from action on app
    const encodedState = defaultAbiCoder.encode(
      [app.appInterface.stateEncoding],
      [app.latestState],
    );
    const encodedFinalState = !!app.latestAction
      ? await new Contract(app.appDefinition, CounterfactualApp.abi, this.provider).applyAction(
          encodedState,
          defaultAbiCoder.encode([app.appInterface.actionEncoding!], [app.latestAction]),
        )
      : encodedState;

    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi).encodeFunctionData("setOutcome", [
        this.getAppIdentity(app, channel.multisigAddress),
        encodedFinalState,
      ]),
    };
    const response = await this.sendContractTransaction(tx);
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
  ): Promise<providers.TransactionReceipt | string> => {
    const challenge = await this.getChallengeOrThrow(app.identityHash);
    this.log.debug(
      `Calling 'cancelChallenge' for ${app.identityHash} at nonce ${toBN(
        challenge.versionNumber,
      ).toString()}`,
    );
    const tx = {
      to: this.challengeRegistry.address,
      value: 0,
      data: new Interface(ChallengeRegistry.abi).encodeFunctionData("cancelDispute", [
        this.getAppIdentity(app, channel.multisigAddress),
        req,
      ]),
    };
    const response = await this.sendContractTransaction(tx);
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
  ): Promise<providers.TransactionReceipt | string> => {
    this.assertSignerCanSendTransactions();

    const KNOWN_ERRORS = ["the tx doesn't have the correct nonce"];
    const MAX_RETRIES = 3;

    const errors: { [k: number]: string } = [];
    for (let attempt = 1; attempt < MAX_RETRIES + 1; attempt += 1) {
      this.log.debug(`Attempt ${attempt}/${MAX_RETRIES} to send transaction to ${transaction.to}`);
      let response: providers.TransactionResponse;
      try {
        response = await this.signer.sendTransaction({
          ...transaction,
          nonce: await this.provider.getTransactionCount(this.signer.address),
        });
        const receipt = await response.wait();
        this.log.debug(`Transaction sent: ${stringify(receipt)}`);
        this.log.info(`Successfully sent transaction ${receipt.transactionHash}`);
        return receipt;
      } catch (e) {
        errors[attempt] = e.message;
        const knownErr = KNOWN_ERRORS.find((err) => e.message.includes(err));
        if (!knownErr) {
          // unknown error, do not retry
          this.log.error(`Failed to send transaction: ${e.stack || e.message}`);
          const msg = `Error sending transaction: ${e.stack || e.message}`;
          return msg;
        }
        // known error, retry
        this.log.warn(
          `Sending transaction attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}. Retrying.`,
        );
      }
    }
    return `Failed to send transaction (errors indexed by attempt): ${stringify(errors)}`;
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
      appDefinition: app.appDefinition,
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

  // returns true IFF:
  // - there is a singly signed commitment for s1
  // - there is a doubly signed commitment for s0
  // - app has action corresponding to s0 --> s1 transition
  // - the challenge may still be progressed (s0 finalized, s1 playable)
  private canPlayAction = async (
    app: AppInstanceJson,
    challenge: StoredAppChallenge,
  ): Promise<boolean> => {
    // make sure the app has an action
    if (!app.latestAction) {
      return false;
    }
    const { identityHash, versionNumber } = challenge;

    // make sure there are valid commitments
    const [latest, prev] = await this.getSortedSetStateCommitments(identityHash);
    // valid IFF latest is single signed, with higher version number then
    // challenge
    const validLatestCommitment =
      !!latest &&
      latest.signatures.filter((x) => !!x).length === 1 &&
      toBN(latest.versionNumber).gt(versionNumber);

    // must be double signed, have eq or greater nonce then existing,
    // and nonce == latest.nonce - 1
    const validPreviousCommitment =
      !!prev &&
      prev.signatures.filter((x) => !!x).length === 2 &&
      toBN(prev.versionNumber).gte(versionNumber) &&
      toBN(prev.versionNumber).add(1).eq(latest.versionNumber._hex);

    if (!validLatestCommitment || !validPreviousCommitment) {
      return false;
    }
    // must also be progressable (state progression window not elapsed)
    const current = await this.provider.getBlockNumber();
    // handle empty challenge case (in initiate) by using current block
    // as the `finalizesAt`
    const noLongerProgressable = toBN(
      challenge.finalizesAt.isZero() ? current : challenge.finalizesAt,
    ).add(app.defaultTimeout);
    return toBN(current).lt(noLongerProgressable);
  };

  private updateChallengeStatus = async (
    status: StoredAppChallengeStatus,
    challenge: StoredAppChallenge,
  ) => {
    this.log.debug(`Transitioning challenge status from ${challenge.status} to ${status}`);
    return this.store.saveAppChallenge({
      ...challenge,
      status,
    });
  };

  private isFreeBalanceApp = async (identityHash: string): Promise<boolean> => {
    const channel = await this.store.getStateChannelByAppIdentityHash(identityHash);
    if (!channel || !channel.freeBalanceAppInstance) {
      return false;
    }
    return channel.freeBalanceAppInstance.identityHash === identityHash;
  };

  private getSortedSetStateCommitments = async (
    identityHash: string,
  ): Promise<SetStateCommitmentJSON[]> => {
    const unsorted = await this.store.getSetStateCommitments(identityHash);
    return unsorted.sort((a, b) => toBN(b.versionNumber).sub(toBN(a.versionNumber)).toNumber());
  };
}
