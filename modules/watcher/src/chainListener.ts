import { ChallengeRegistry } from "@connext/contracts";
import {
  ILoggerService,
  ChallengeEvents,
  ChallengeEvent,
  ChallengeEventData,
  ChallengeStatus,
  Address,
  ContractAddressBook,
  STATE_PROGRESSED_EVENT,
  CHALLENGE_UPDATED_EVENT,
  ChallengeUpdatedEventPayload,
  StateProgressedEventPayload,
} from "@connext/types";
import { toBN } from "@connext/utils";
import { BigNumber, Contract, Event, providers, utils } from "ethers";
import { Ctx, Evt } from "evt";

const { Interface } = utils;

// While fetching historical data, we query this many blocks at a time
const chunkSize = 30;

// contract events are camel cased while offchain events are all caps
// this type is generated to bridge the gap for the listener
const ChainListenerEvents = {
  [CHALLENGE_UPDATED_EVENT]: CHALLENGE_UPDATED_EVENT,
  [STATE_PROGRESSED_EVENT]: STATE_PROGRESSED_EVENT,
} as const;
type ChainListenerEvent = keyof typeof ChainListenerEvents;

interface ChainListenerEventsMap {
  [CHALLENGE_UPDATED_EVENT]: ChallengeUpdatedEventPayload;
  [STATE_PROGRESSED_EVENT]: StateProgressedEventPayload;
}
type ChainListenerEventData = {
  [P in keyof ChainListenerEventsMap]: ChainListenerEventsMap[P];
};

////////////////////////////////////////
// Listener interface

interface IChainListener {

  ////////////////////////////////////////
  //// Public methods

  attach<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;

  attachOnce<T extends ChallengeEvent>(
    event: T,
    callback: (data: ChallengeEventData[T]) => Promise<void>,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): void;

  waitFor<T extends ChallengeEvent>(
    event: T,
    timeout: number,
    providedFilter?: (data: ChallengeEventData[T]) => boolean,
    ctx?: Ctx<ChallengeEventData[T]>,
  ): Promise<ChallengeEventData[T]>;

  detach<T extends ChallengeEvent>(ctx?: Ctx<ChallengeEventData[T]>): void;

  enable(): Promise<void>;
  disable(): Promise<void>;

  parseLogsFrom(startingBlock: number): Promise<void>;

  ////////////////////////////////////////
  //// Unused methods (TODO: rm?)

  createContext<T extends ChallengeEvent>(): Ctx<ChallengeEventData[T]>;
}

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
  private registries: { [chainId: number]: Contract };

  constructor(
    private readonly providers: { [chainId: number]: providers.JsonRpcProvider },
    private readonly context: ContractAddressBook,
    loggerService: ILoggerService,
    private readonly evtChallengeUpdated: Evt<
      ChainListenerEventData[typeof ChainListenerEvents.CHALLENGE_UPDATED_EVENT]
    > = Evt.create<ChainListenerEventData[typeof ChainListenerEvents.CHALLENGE_UPDATED_EVENT]>(),
    private readonly evtStateProgressed: Evt<
      ChainListenerEventData[typeof ChainListenerEvents.STATE_PROGRESSED_EVENT]
    > = Evt.create<ChainListenerEventData[typeof ChainListenerEvents.STATE_PROGRESSED_EVENT]>(),
  ) {
    this.log = loggerService.newContext("ChainListener");
    const registries = {};
    Object.entries(this.providers).forEach(([chainId, provider]) => {
      registries[chainId] = new Contract(
        this.context[chainId].ChallengeRegistry,
        ChallengeRegistry.abi,
        provider,
      );
    });
    this.registries = registries;
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
    const chainIds = Object.keys(this.providers).map((k) => parseInt(k));
    for (const chainId of chainIds) {
      const currentBlock = await this.providers[chainId].getBlockNumber();
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

        const newUpdatedLogs = await this.providers[chainId].getLogs({
          ...this.registries[chainId].filters[ChallengeEvents.ChallengeUpdated](),
          fromBlock,
          toBlock,
        });
        const newProgressedLogs = await this.providers[chainId].getLogs({
          ...this.registries[chainId].filters[ChallengeEvents.StateProgressed](),
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

      progressedLogs.forEach((log) => {
        const args = (new Interface(ChallengeRegistry.abi).parseLog(log)).args;
        const { action, identityHash, signature, timeout, turnTaker, versionNumber } = args;
        this.evtStateProgressed.post({
          identityHash,
          action,
          versionNumber,
          timeout,
          turnTaker,
          signature,
          chainId,
        });
      });

      updatedLogs.forEach((log) => {
        const args = (new Interface(ChallengeRegistry.abi).parseLog(log)).args;
        const { appStateHash, finalizesAt, identityHash, status, versionNumber } = args;
        this.evtChallengeUpdated.post({
          identityHash,
          status,
          appStateHash,
          versionNumber,
          finalizesAt,
          chainId,
        });
      });

    }
  };

  ////////////////////////////////////////
  // Evt methods

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

  ////////////////////////////////////////
  // Private methods

  private removeChallengeRegistryListeners = (): void => {
    Object.keys(this.providers).forEach(chainId => {
      this.registries[chainId].removeAllListeners(ChallengeEvents.StateProgressed);
      this.registries[chainId].removeAllListeners(ChallengeEvents.ChallengeUpdated);
    });
    this.log.debug("Removed challenge registry listeners");
  };

  // created listeners for the challenge registry
  private addChallengeRegistryListeners = (): void => {
    const chainIds = Object.keys(this.providers);
    chainIds.forEach((chainIdStr) => {
      const chainId = parseInt(chainIdStr);
      this.registries[chainId].on(
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
            chainId,
          });
        },
      );

      this.registries[chainId].on(
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
            chainId,
          });
        },
      );
    });
    this.log.debug("Registered challenge registry listeners");
  };
}
