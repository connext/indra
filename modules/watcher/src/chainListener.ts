import { JsonRpcProvider } from "ethers/providers";
import { EventEmitter } from "eventemitter3";
import { ILoggerService, NetworkContext, ContractEvents } from "@connext/types";
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
export class ChainListener extends EventEmitter {

  private log: ILoggerService;
  private enabled: boolean = false;

  constructor(
    private readonly ethProvider: JsonRpcProvider,
    private readonly context: NetworkContext,

    loggerService: ILoggerService,
  ) {
    super();
    this.log = loggerService.newContext("ChainListener");
  }

  // listens on every block for new contract events
  public enable = (): void => {
    this.enabled = true;
    this.addChallengeRegistryListeners();
  }

  // turns of the listener and event emission
  public disable = async (): Promise<void> => {
    this.enabled = false;
    this.removeChallengeRegistryListeners();
  }

  // ensures the listener is "on"
  private assertEnabled() {
    if (this.enabled) {
      return;
    }
    throw new Error(`Listener is not enabled`);
  }

  // created listeners for the challenge registry
  private removeChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi,
      this.ethProvider,
    );

    challengeRegistry.removeAllListeners(ContractEvents.StateProgressed);
    challengeRegistry.removeAllListeners(ContractEvents.ChallengeUpdated);
    this.log.debug("Removed challenge registry listeners");
  }

  // created listeners for the challenge registry
  private addChallengeRegistryListeners = (): void => {
    const challengeRegistry = new Contract(
      this.context.ChallengeRegistry,
      ChallengeRegistry.abi,
      this.ethProvider,
    );

    challengeRegistry.on(ContractEvents.StateProgressed, (event: Event) => {
      this.emit(
        ContractEvents.StateProgressed, 
        parseStateProgressedEvent(event),
      );
    });

    challengeRegistry.on(ContractEvents.ChallengeUpdated, (event: Event) => {
      this.emit(
        ContractEvents.StateProgressed, 
        parseChallengeUpdatedEvent(event),
      );
    });
  
    this.log.debug("Registered challenge registry listeners");
  }
}