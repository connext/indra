import { JsonRpcProvider } from "ethers/providers";
import {
  NetworkContext,
  ILoggerService,
  IWatcherStoreService,
  WatcherInitOptions,
  IWatcher,
  WatcherEvent,
  WatcherEventData,
  IChannelSigner,
} from "@connext/types";
import { ChainListener } from "./chainListener";
import EventEmitter from "eventemitter3";

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
    throw new Error("Method not implemented");
  }

  // used to create a new watcher instance from the passed
  // in options (which are cast to the proper values)
  public static init = async (opts: WatcherInitOptions): Promise<Watcher> => {
    throw new Error("Method not implemented");
  };

  //////// Watcher methods
  // will begin an onchain dispute. emits a `DisputeInitiated` event if
  // the initiation was successful, otherwise emits a `DisputeFailed`
  // event
  public initiate = async (appInstanceId: string): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // begins responding to events and starts all listeners
  // also catches up to current block from latest processed
  public enable = async (): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // pauses all listeners and responses
  public disable = async (): Promise<void> => {
    throw new Error("Method not implemented");
  };

  //////// Listener methods
  public emit<T extends WatcherEvent>(event: T, data: WatcherEventData[T]): void {
    throw new Error("Method not implemented");
  }

  public on<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void {
    throw new Error("Method not implemented");
  }

  public once<T extends WatcherEvent>(
    event: T,
    callback: (data: WatcherEventData[T]) => Promise<void>,
  ): void {
    throw new Error("Method not implemented");
  }

  public removeListener<T extends WatcherEvent>(event: T): void {
    throw new Error("Method not implemented");
  }

  public removeAllListeners(): void {
    throw new Error("Method not implemented");
  }

  // will insert + respond to any events that have occurred from
  // the latest processed block to the provided block
  private catchupTo = async (blockNumber: number): Promise<void> => {
    throw new Error("Method not implemented");
  };
}
