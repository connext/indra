import { ChallengeRegistry } from "@connext/contracts";
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
import { toBN } from "@connext/utils";
import { BigNumber, Contract, Event, providers, utils } from "ethers";
import EventEmitter from "eventemitter3";

const { Interface } = utils;

// While fetching historical data, we query this many blocks at a time
const chunkSize = 30;

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
    private readonly provider: providers.JsonRpcProvider,
    private readonly context: NetworkContext,
    loggerService: ILoggerService,
  ) {
    this.log = loggerService.newContext("ChainListener");
    this.log.debug(
      `Creating new ChainListener for ChallengeRegistry at ${this.context.ChallengeRegistry}`,
    );
    this.emitter = new EventEmitter();
    this.challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi,
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

  // parses + emits any event logs from given block to current block
  public parseLogsFrom = async (startingBlock: number): Promise<void> => {
    const currentBlock = await this.provider.getBlockNumber();
    if (startingBlock > currentBlock) {
      throw new Error(
        `Cannot parse events past current block (current: ${currentBlock}, starting: ${startingBlock})`,
      );
    }

    const nChunks = Math.ceil((currentBlock - startingBlock) / chunkSize);
    this.log.info(`Fetching logs from block ${startingBlock} to ${currentBlock}`);

    const updatedLogs = [] as providers.Log[];
    const progressedLogs = [] as providers.Log[];
    for (let index = 0; index <= nChunks; index++) {
      const fromBlock = startingBlock + index * chunkSize;
      const nextChunk = startingBlock + (index + 1) * chunkSize - 1;
      const toBlock = nextChunk >= currentBlock ? currentBlock : nextChunk;

      const newUpdatedLogs = await this.provider.getLogs({
        ...this.challengeRegistry.filters[ChallengeEvents.ChallengeUpdated](),
        fromBlock,
        toBlock,
      });
      const newProgressedLogs = await this.provider.getLogs({
        ...this.challengeRegistry.filters[ChallengeEvents.StateProgressed](),
        fromBlock,
        toBlock,
      });

      updatedLogs.push(...newUpdatedLogs);
      progressedLogs.push(...newProgressedLogs);
      this.log.info(
        `Fetched ${progressedLogs.length} StateProgressed & ${newUpdatedLogs.length} ` +
          `ChallengeUpdated logs from block ${fromBlock} to ${toBlock} (${index}/${nChunks})`,
      );
      if (toBlock === currentBlock) break;
    }

    this.log.info(
      `Parsing ${progressedLogs.length} StateProgessed and ${updatedLogs.length} ChallengeUpdated event logs`,
    );

    progressedLogs.concat(updatedLogs).forEach((log) => {
      const parsed = new Interface(ChallengeRegistry.abi).parseLog(log);
      const { identityHash, versionNumber } = parsed.values;
      switch (parsed.name) {
        case ChallengeEvents.ChallengeUpdated: {
          const { appStateHash, finalizesAt, status } = parsed.values;
          this.emit(ChallengeEvents.ChallengeUpdated, {
            identityHash,
            status,
            appStateHash,
            versionNumber,
            finalizesAt,
          });
          break;
        }
        case ChallengeEvents.StateProgressed: {
          const { action, timeout, turnTaker, signature } = parsed.values;
          this.emit(ChallengeEvents.StateProgressed, {
            identityHash,
            action,
            versionNumber,
            timeout,
            turnTaker,
            signature,
          });
          break;
        }
        default: {
          throw new Error(`Unrecognized event name from parsed logs: ${parsed.name}`);
        }
      }
    });
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

  //////// Private methods
  // created listeners for the challenge registry

  private removeChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi,
      this.provider,
    );

    challengeRegistry.removeAllListeners(ChallengeEvents.StateProgressed);
    challengeRegistry.removeAllListeners(ChallengeEvents.ChallengeUpdated);
    this.log.debug("Removed challenge registry listeners");
  };

  // created listeners for the challenge registry
  private addChallengeRegistryListeners = (): void => {
    this.challengeRegistry.on(
      ChallengeEvents.StateProgressed,
      (
        identityHash: string,
        action: string,
        versionNumber: BigNumber,
        timeout: BigNumber,
        turnTaker: Address,
        signature: string,
        event: Event,
      ) => {
        this.emit(ChallengeEvents.StateProgressed, {
          identityHash,
          action,
          versionNumber: toBN(versionNumber),
          timeout: toBN(timeout),
          turnTaker,
          signature,
        });
      },
    );

    this.challengeRegistry.on(
      ChallengeEvents.ChallengeUpdated,
      (
        identityHash: string,
        status: ChallengeStatus,
        appStateHash: string,
        versionNumber: BigNumber,
        finalizesAt: BigNumber,
      ) => {
        this.emit(ChallengeEvents.ChallengeUpdated, {
          identityHash,
          status,
          appStateHash,
          versionNumber: toBN(versionNumber),
          finalizesAt: toBN(finalizesAt),
        });
      },
    );

    this.log.debug("Registered challenge registry listeners");
  };
}
