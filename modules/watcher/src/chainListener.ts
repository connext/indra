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

  constructor(
    private readonly ethProvider: JsonRpcProvider,
    private readonly context: NetworkContext,

    loggerService: ILoggerService,
  ) {
    throw new Error("Method not implemented");
  }

  // listens on every block for new contract events
  public enable = (): Promise<void> => {
    throw new Error("Method not implemented");
  };

  // turns of the listener and event emission
  public disable = async (): Promise<void> => {
    throw new Error("Method not implemented");
  };

  //////// Listener methods
  public emit<T extends ChallengeEvent>(event: T, data: ChallengeEventData[T]): void {
    throw new Error("Method not implemented");
  }

  public on<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void {
    throw new Error("Method not implemented");
  }

  public once<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void {
    throw new Error("Method not implemented");
  }

  public removeListener<T extends ChallengeEvent>(event: T): void {
    throw new Error("Method not implemented");
  }

  public removeAllListeners(): void {
    throw new Error("Method not implemented");
  }

  // created listeners for the challenge registry
  private removeChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi as any,
      this.ethProvider,
    );

    challengeRegistry.removeAllListeners(ChallengeEvents.StateProgressed);
    challengeRegistry.removeAllListeners(ChallengeEvents.ChallengeUpdated);
    this.log.debug("Removed challenge registry listeners");
  };

  // created listeners for the challenge registry
  private addChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi as any,
      this.ethProvider,
    );

    challengeRegistry.on(ChallengeEvents.StateProgressed, async (event: Event) => {
      this.emit(ChallengeEvents.StateProgressed, await parseStateProgressedEvent(event));
    });

    challengeRegistry.on(ChallengeEvents.ChallengeUpdated, async (event: Event) => {
      this.emit(ChallengeEvents.ChallengeUpdated, await parseChallengeUpdatedEvent(event));
    });

    this.log.debug("Registered challenge registry listeners");
  };
}
