import { Wallet } from "ethers";
import { JsonRpcProvider, TransactionReceipt } from "ethers/providers";
import { 
  NetworkContext, 
  ILoggerService, 
  AppChallengeBigNumber, 
  StateProgressedEvent, 
  ChallengeUpdatedEvent,
  ContractEvent,
} from "@connext/types";
import { ConsoleLogger } from "@connext/utils";
import { ChainListener } from "./chainListener";
import EventEmitter from "eventemitter3";

type WatcherInitOptions = {
  wallet: Wallet | string;
  provider: JsonRpcProvider | string;
  context: NetworkContext;
  store: IWatcherStoreService;
  log?: ILoggerService;
}

// events emitted by watcher service
const WatcherEvents = enumify({
  ChallengeInitiated: "ChallengeInitiated",
  ChallengeInitiationFailed: "ChallengeInitiationFailed",
  ChallengeUpdated: "ChallengeUpdated",
  ChallengeUpdateFailed: "ChallengeUpdateFailed",
  ChallengeCompleted: "ChallengeCompleted",
});
type WatcherEvents = (typeof WatcherEvents)[keyof typeof WatcherEvents];
type WatcherEvent = keyof typeof WatcherEvents;

type ChallengeInitiatedPayload = {
  transaction: TransactionReceipt;
  challenge: AppChallengeBigNumber;
  appInstanceId: string;
  multisigAddress: string;
};

type ChallengeInitiationFailedPayload = {
  error: string;
  appInstanceId: string;
  multisigAddress: string;
};

type ChallengeUpdateFailedPayload = ChallengeInitiationFailedPayload & {
  challenge: AppChallengeBigNumber; // current challenge onchain (unupdated)
};

type ChallengeUpdatedPayload = ChallengeInitiatedPayload;

type ChallengeCompletedPayload = ChallengeInitiatedPayload;

type WatcherEventPayload = 
  | ChallengeInitiatedPayload
  | ChallengeInitiationFailedPayload
  | ChallengeUpdateFailedPayload
  | ChallengeUpdatedPayload
  | ChallengeCompletedPayload

// this store interface should have all of the getter functions
// included in `IStoreService` in addition to the functions defined
// here
interface IWatcherStoreService {
  ///// Events
  getLatestProcessedBlock(): Promise<number>;
  createLatestProcessedBlock(): Promise<number>;
  updateLatestProcessedBlock(blockNumber: number): Promise<void>

  ///// Disputes
  getAppChallenge(appIdentityHash: string): Promise<AppChallengeBigNumber>;
  createAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void>;
  updateAppChallenge(multisigAddress: string, appChallenge: AppChallengeBigNumber): Promise<void>;

  ///// Events
  getStateProgressedEvent(appIdentityHash: string): Promise<StateProgressedEvent>;
  createStateProgressedEvent(
    multisigAddress: string, 
    appChallenge: StateProgressedEvent,
  ): Promise<void>;
  updateStateProgressedEvent(
    multisigAddress: string, 
    appChallenge: StateProgressedEvent,
  ): Promise<void>;

  getChallengeUpdateEvent(appIdentityHash: string): Promise<ChallengeUpdatedEvent>;
  createChallengeUpdateEvent(
    multisigAddress: string, 
    event: ChallengeUpdatedEvent,
  ): Promise<void>;
  updateChallengeUpdateEvent(
    multisigAddress: string, 
    appChallenge: ChallengeUpdatedEvent,
  ): Promise<void>;
}

/**
 * Watchers will watch for contract events and respond to disputes on behalf
 * of channel participants. They can also be used to initiate disputes.
 * 
 * To use the watcher class, call `await Watcher.init(opts)`, this will
 * automatically begin the dispute response process.
 */
export class Watcher {

  private log: ILoggerService;
  private enabled: boolean = false;
  private emitter: EventEmitter;

  constructor(
    private readonly wallet: Wallet,
    private readonly provider: JsonRpcProvider,
    private readonly context: NetworkContext,
    private readonly store: IWatcherStoreService,
    private readonly listener: ChainListener,
    log: ILoggerService,
  ) {
    this.emitter = new EventEmitter();
    this.log = log.newContext("Watcher");
  }

  // used to create a new watcher instance from the passed
  // in options (which are cast to the proper values)
  public static init = async (opts: WatcherInitOptions): Promise<Watcher> => {
    const provider = typeof opts.provider === "string"
      ? new JsonRpcProvider(opts.provider) : opts.provider;

    const wallet = typeof opts.wallet === "string"
      ? new Wallet(opts.wallet).connect(provider) 
      : opts.wallet.connect(provider);
    
    const log = opts.log || new ConsoleLogger();
    const watcher = new Watcher(
      wallet,
      provider,
      opts.context,
      opts.store,
      new ChainListener(
        provider,
        opts.context,
        log,
      ),
      log,
    );
    await watcher.enable();
    return watcher;
  }

  // begins responding to events and starts all listeners
  // also catches up to current block from latest processed
  public enable = async (): Promise<void> => {
    this.listener.enable();
    const currentBlock = await this.provider.getBlockNumber();
    await this.catchupTo(currentBlock);
    this.enabled = true;
    throw new Error("Method not implemented");
  }

  // pauses all listeners and responses
  public disable = async (): Promise<void> => {
    this.listener.disable();
    const currentBlock = await this.provider.getBlockNumber();
    await this.store.updateLatestProcessedBlock(currentBlock - 1);
    this.enabled = false;
    throw new Error("Method not implemented");
  }

  //////// Listener methods
  public on(
    event: WatcherEvent | ContractEvent, 
    callback: (data: WatcherEventPayload) => Promise<void>,
  ) {
    this.emitter.on(event, callback);
  }

  public once(
    event: WatcherEvent | ContractEvent, 
    callback: (data: WatcherEventPayload) => Promise<void>,
  ) {
    this.emitter.once(event, callback);
  }

  public off(event: WatcherEvent | ContractEvent) {
    this.emitter.off(event);
  }

  public removeListener(event: WatcherEvent | ContractEvent) {
    this.emitter.removeListener(event);
  }

  public removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  //////// Watcher methods

  // will begin an onchain dispute. emits a `DisputeInitiated` event if
  // the initiation was successful, otherwise emits a `DisputeFailed`
  // event
  public initiate = async (appInstanceId: string): Promise<void> => {
    throw new Error("Method not implemented");
  }

  // will insert + respond to any events that have occurred from
  // the latest processed block to the provided block
  private catchupTo = async (blockNumber: number): Promise<void> => {
    throw new Error("Method not implemented");
  }
}