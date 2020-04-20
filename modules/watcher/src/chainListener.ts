import { JsonRpcProvider } from "ethers/providers";
import {
  ILoggerService,
  NetworkContext,
  ChallengeEvents,
  IChainListener,
  ChallengeEvent,
  ChallengeEventData,
  ChallengeStatus,
  Address,
} from "@connext/types";
import { ChallengeRegistry } from "@connext/contracts";
import { toBN } from "@connext/utils";
import { Contract, Event } from "ethers";
import EventEmitter from "eventemitter3";
import { BigNumber } from "ethers/utils";

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
    this.emitter.emit(event, data);
  }

  public on<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
  ): void {
    this.emitter.on(event, callback);
  }

  public once<T extends ChallengeEvent>(event: T, callback: (data: any) => Promise<void>): void {
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
    this.challengeRegistry.on(ChallengeEvents.StateProgressed, (
      identityHash: string,
      action: string,
      versionNumber: BigNumber,
      timeout: BigNumber,
      turnTaker: Address,
      signature: string,
      event: Event,
    ) => {
      this.emit(
        ChallengeEvents.StateProgressed, 
        {
          identityHash,
          action,
          versionNumber: toBN(versionNumber),
          timeout: toBN(timeout),
          turnTaker,
          signature,
        },
      );
    });

    this.challengeRegistry.on(
      ChallengeEvents.ChallengeUpdated,
      (
        identityHash: string, 
        status: ChallengeStatus, 
        appStateHash: string, 
        versionNumber: BigNumber, 
        finalizesAt: BigNumber, 
      ) => {
        this.emit(
          ChallengeEvents.ChallengeUpdated,
          {
            identityHash,
            status,
            appStateHash,
            versionNumber: toBN(versionNumber),
            finalizesAt: toBN(finalizesAt),
          },
        );
      },
    );

    this.log.debug("Registered challenge registry listeners");
  };
}
