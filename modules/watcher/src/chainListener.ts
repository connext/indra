import { JsonRpcProvider } from "ethers/providers";
import {
  ILoggerService,
  NetworkContext,
  ChallengeEvents,
  IChainListener,
  ChallengeEvent,
  ChallengeEventData,
} from "@connext/types";
import { ChallengeRegistry } from "@connext/contracts";
import { Contract, Event } from "ethers";
import { parseChallengeUpdatedEvent, parseStateProgressedEvent } from "./utils";
import EventEmitter from "eventemitter3";

/**
 * This class listens to events emitted by the connext contracts,
 * parses them, and emits the properly typed version.
 *
 * Consumers of the class should instantiate it, then call the
 * `enable` method to begin listening + parsing contract events. To
 * turn off the listener, call `disable`
 */
export class ChainListener implements IChainListener {
  private log: ILoggerService;
  private enabled: boolean = false;
  private emitter: EventEmitter;
  private challengeRegistry: Contract;

  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly context: NetworkContext,
    loggerService: ILoggerService,
  ) {
    this.log = loggerService.newContext("ChainListener");
    this.emitter = new EventEmitter();
    this.challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi as any,
      this.provider,
    );
  }

  // listens on every block for new contract events
  public enable = async (): Promise<void> => {
    if (this.enabled) {
      return;
    }
    this.addChallengeRegistryListeners();
    this.enabled = true;
  };

  // turns of the listener and event emission
  public disable = async (): Promise<void> => {
    if (!this.enabled) {
      return;
    }
    this.removeChallengeRegistryListeners();
    this.enabled = false;
  };

  //////// Listener methods
  public emit<T extends ChallengeEvent>(event: T, data: ChallengeEventData[T]): void {
    console.log(`emitting ${event} with data:`, data);
    this.emitter.emit(event, data);
  }

  public on<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void {
    this.emitter.on(event, callback);
  }

  public once<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void {
    this.emitter.once(event, callback);
  }

  public removeListener<T extends ChallengeEvent>(event: T): void {
    this.emitter.removeListener(event);
  }

  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  // created listeners for the challenge registry
  private removeChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi as any,
      this.provider,
    );

    challengeRegistry.removeAllListeners(ChallengeEvents.StateProgressed);
    challengeRegistry.removeAllListeners(ChallengeEvents.ChallengeUpdated);
    this.log.debug("Removed challenge registry listeners");
  };

  // created listeners for the challenge registry
  private addChallengeRegistryListeners = (): void => {
    this.challengeRegistry.on(ChallengeEvents.StateProgressed, async (event: Event) => {
      this.emit(
        ChallengeEvents.StateProgressed, 
        await parseStateProgressedEvent(event),
      );
    });

    this.challengeRegistry.on(ChallengeEvents.ChallengeUpdated, async (event: Event) => {
      this.emit(
        ChallengeEvents.ChallengeUpdated, 
        await parseChallengeUpdatedEvent(event),
      );
    });

    this.log.debug("Registered challenge registry listeners");
  };
}
