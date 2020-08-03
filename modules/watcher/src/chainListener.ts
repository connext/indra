import { ChallengeRegistry } from "@connext/contracts";
import {
  ILoggerService,
  ChallengeEvents,
  IChainListener,
  ChallengeEvent,
  ChallengeEventData,
  ChallengeStatus,
  Address,
  ContractAddresses,
} from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumber, Contract, Event, providers, utils } from "ethers";
import { Ctx, Evt } from "evt";

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
  private challengeRegistry: Contract;

  constructor(
    private readonly provider: providers.JsonRpcProvider,
    private readonly context: ContractAddresses,
    loggerService: ILoggerService,
    private readonly evtChallengeUpdated: Evt<
      ChallengeEventData[typeof ChallengeEvents.ChallengeUpdated]
    > = Evt.create<ChallengeEventData[typeof ChallengeEvents.ChallengeUpdated]>(),
    private readonly evtStateProgressed: Evt<
      ChallengeEventData[typeof ChallengeEvents.StateProgressed]
    > = Evt.create<ChallengeEventData[typeof ChallengeEvents.StateProgressed]>(),
  ) {
    this.log = loggerService.newContext("ChainListener");
    this.log.debug(
      `Creating new ChainListener for ChallengeRegistry at ${this.context.ChallengeRegistry}`,
    );
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
    this.detach();
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
      const { identityHash, versionNumber } = parsed.args;
      switch (parsed.name) {
        case ChallengeEvents.ChallengeUpdated: {
          const { appStateHash, finalizesAt, status } = parsed.args;
          this.evtChallengeUpdated.post({
            identityHash,
            status,
            appStateHash,
            versionNumber,
            finalizesAt,
          });
          break;
        }
        case ChallengeEvents.StateProgressed: {
          const { action, timeout, turnTaker, signature } = parsed.args;
          this.evtStateProgressed.post({
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

  //////// Evt methods
  public attach<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void {
    const filter = (data: ChallengeEventData[T]) => {
      if (providedFilter) {
        return providedFilter(data);
      }
      return true;
    };
    const addToEvt = (evt: Evt<ChallengeEventData[T]>) => {
      if (!ctx) {
        evt.attach(filter, callback);
        return;
      }
      evt.attach(filter, ctx, callback);
    };
    return addToEvt(
      event === ChallengeEvents.ChallengeUpdated
        ? (this.evtChallengeUpdated as any)
        : (this.evtStateProgressed as any),
    );
  }

  public attachOnce<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void {
    const filter = (data: ChallengeEventData[T]) => {
      if (providedFilter) {
        return providedFilter(data);
      }
      return true;
    };
    const addToEvt = (evt: Evt<ChallengeEventData[T]>) => {
      if (!ctx) {
        evt.attachOnce(filter, callback);
        return;
      }
      evt.attachOnce(filter, ctx, callback);
    };
    return addToEvt(
      event === ChallengeEvents.ChallengeUpdated
        ? (this.evtChallengeUpdated as any)
        : (this.evtStateProgressed as any),
    );
  }

  public async waitFor<T extends ChallengeEvent>(
    event: T,
    timeout: number,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): Promise<ChallengeEventData[T]> {
    const filter = (data: ChallengeEventData[T]) => {
      if (providedFilter) {
        return providedFilter(data);
      }
      return true;
    };
    const addToEvt = (evt: Evt<ChallengeEventData[T]>) => {
      if (!ctx) {
        return evt.waitFor(filter, timeout);
      }
      return evt.waitFor(filter, ctx, timeout);
    };
    return addToEvt(
      event === ChallengeEvents.ChallengeUpdated
        ? (this.evtChallengeUpdated as any)
        : (this.evtStateProgressed as any),
    );
  }

  // Creates a new void context for easy listener detachment
  public createContext<T extends ChallengeEvent>(): Ctx<ChallengeEventData[T]> {
    return Evt.newCtx<ChallengeEventData[T]>();
  }

  public detach<T extends ChallengeEvent>(ctx?: Ctx<ChallengeEventData[T]>): void {
    this.evtChallengeUpdated.detach(ctx as any);
    this.evtStateProgressed.detach(ctx as any);
  }

  //////// Private methods

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
        this.evtStateProgressed.post({
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
        this.evtChallengeUpdated.post({
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
