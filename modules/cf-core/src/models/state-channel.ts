import {
  AppInstanceJson,
  CriticalStateChannelAddresses,
  IStoreService,
  PublicIdentifier,
  SolidityValueType,
  StateChannelJSON,
  StateSchemaVersion,
} from "@connext/types";
import {
  deBigNumberifyJson,
  getSignerAddressFromPublicIdentifier,
  stringify,
  toBN,
} from "@connext/utils";

import { BigNumber } from "ethers";

import { HARD_CODED_ASSUMPTIONS } from "../constants";

import { AppInstance } from "./app-instance";
import { createFreeBalance, FreeBalanceClass, TokenIndexedCoinTransferMap } from "./free-balance";
import { flipTokenIndexedBalances } from "./utils";
import { NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH } from "../errors";

const ERRORS = {
  APPS_NOT_EMPTY: (size: number) => `Expected the appInstances list to be empty but size ${size}`,
  APP_DOES_NOT_EXIST: (identityHash: string) =>
    `Attempted to retrieve an appInstance that does not exist: identity hash = ${identityHash}`,
  FREE_BALANCE_MISSING: "Cannot find ETH Free Balance App in StateChannel",
  FREE_BALANCE_IDX_CORRUPT: (idx: string) => `Index ${idx} used to find ETH Free Balance is broken`,
  INSUFFICIENT_FUNDS: "Attempted to install an appInstance without sufficient funds",
  MULTISIG_OWNERS_NOT_SORTED: "multisigOwners parameter of StateChannel must be sorted",
};

export class StateChannel {
  constructor(
    public readonly multisigAddress: string,
    public readonly addresses: CriticalStateChannelAddresses,
    public readonly initiatorIdentifier: string,
    public readonly responderIdentifier: string,
    readonly proposedAppInstances: ReadonlyMap<string, AppInstanceJson> = new Map<
      string,
      AppInstanceJson
    >([]),
    readonly appInstances: ReadonlyMap<string, AppInstance> = new Map<string, AppInstance>([]),
    private readonly freeBalanceAppInstance?: AppInstance,
    private readonly monotonicNumProposedApps: number = 0,
    public readonly schemaVersion: number = StateSchemaVersion,
  ) {}

  public get multisigOwners() {
    return this.getSigningKeysFor(this.initiatorIdentifier, this.responderIdentifier);
  }

  public get userIdentifiers(): string[] {
    return [this.initiatorIdentifier, this.responderIdentifier];
  }

  public get numProposedApps() {
    return this.monotonicNumProposedApps;
  }

  public get numActiveApps() {
    return this.appInstances.size;
  }

  public incrementNumProposedApps(): StateChannel {
    return this.build({
      monotonicNumProposedApps: this.monotonicNumProposedApps + 1,
    });
  }

  public getAppInstance(appIdentityHash: string): AppInstance {
    if (this.hasFreeBalance && appIdentityHash === this.freeBalance.identityHash) {
      return this.freeBalance;
    }
    if (!this.appInstances.has(appIdentityHash)) {
      throw new Error(ERRORS.APP_DOES_NOT_EXIST(appIdentityHash));
    }
    return this.appInstances.get(appIdentityHash)!;
  }

  public hasAppInstance(appIdentityHash: string): boolean {
    return this.appInstances.has(appIdentityHash);
  }

  public hasAppProposal(appIdentityHash: string): boolean {
    return this.proposedAppInstances.has(appIdentityHash);
  }

  public hasAppInstanceOfKind(address: string): boolean {
    return (
      Array.from(this.appInstances.values()).filter((appInstance: AppInstance) => {
        return appInstance.appDefinition === address;
      }).length > 0
    );
  }

  public getAppInstanceByAppSeqNo(appSeqNo: number): AppInstance {
    if (this.appInstances.size === 0) {
      throw new Error("There are no installed AppInstances in this StateChannel");
    }
    const appInstance = [...this.appInstances.values()].find(
      (instance) => instance.appSeqNo === appSeqNo,
    );
    if (!appInstance) throw new Error(`No app instance exists for given appSeqNo: ${appSeqNo}`);
    return appInstance;
  }

  public mostRecentlyProposedAppInstance(): AppInstanceJson {
    if (this.proposedAppInstances.size === 0) {
      throw new Error("There are no proposed AppInstances in this StateChannel");
    }
    return [...this.proposedAppInstances.values()].reduce((prev, current) =>
      current.appSeqNo > prev.appSeqNo ? current : prev,
    );
  }

  public getAppInstanceOfKind(address: string) {
    const appInstances = Array.from(this.appInstances.values()).filter(
      (appInstance: AppInstance) => {
        return appInstance.appDefinition === address;
      },
    );
    if (appInstances.length !== 1) {
      throw new Error(
        `Either 0 or more than 1 AppInstance of addr ${address} exists on channel: ${this.multisigAddress}`,
      );
    }
    return appInstances[0];
  }

  public getAppInstancesOfKind(address: string) {
    const appInstances = Array.from(this.appInstances.values()).filter(
      (appInstance: AppInstance) => {
        return appInstance.appDefinition === address;
      },
    );
    if (appInstances.length === 0) {
      throw new Error(
        `No AppInstance of addr ${address} exists on channel: ${this.multisigAddress}`,
      );
    }
    return appInstances;
  }

  public isAppInstanceInstalled(appIdentityHash: string) {
    return this.appInstances.has(appIdentityHash);
  }

  public getSigningKeysFor(initiatorId: string, responderId: string): string[] {
    return [
      getSignerAddressFromPublicIdentifier(initiatorId),
      getSignerAddressFromPublicIdentifier(responderId),
    ];
  }

  public get hasFreeBalance(): boolean {
    return !!this.freeBalanceAppInstance;
  }

  public get freeBalance(): AppInstance {
    if (this.freeBalanceAppInstance) {
      return this.freeBalanceAppInstance;
    }

    throw new Error("There is no free balance app instance installed in this state channel");
  }

  public getMultisigOwnerAddrOf(identifer: string): string {
    if (!this.userIdentifiers.find((k) => k === identifer)) {
      throw new Error(
        `getMultisigOwnerAddrOf received invalid id not in multisigOwners: ${identifer}`,
      );
    }

    return getSignerAddressFromPublicIdentifier(identifer);
  }

  public getFreeBalanceAddrOf(identifier: string): string {
    const alice = this.freeBalanceAppInstance!.initiatorIdentifier;
    const bob = this.freeBalanceAppInstance!.responderIdentifier;

    if (identifier !== alice && identifier !== bob) {
      throw new Error(
        `getFreeBalanceAddrOf received invalid id without free balance account: ${identifier}`,
      );
    }

    return getSignerAddressFromPublicIdentifier(identifier);
  }

  public getFreeBalanceClass() {
    return FreeBalanceClass.fromAppInstance(this.freeBalance);
  }

  private build = (args: {
    multisigAddress?: string;
    addresses?: CriticalStateChannelAddresses;
    initiatorIdentifier?: string;
    responderIdentifier?: string;
    appInstances?: ReadonlyMap<string, AppInstance>;
    proposedAppInstances?: ReadonlyMap<string, AppInstanceJson>;
    freeBalanceAppInstance?: AppInstance;
    monotonicNumProposedApps?: number;
    schemaVersion?: number;
  }) => {
    return new StateChannel(
      args.multisigAddress || this.multisigAddress,
      args.addresses || this.addresses,
      args.initiatorIdentifier || this.initiatorIdentifier,
      args.responderIdentifier || this.responderIdentifier,
      args.proposedAppInstances || this.proposedAppInstances,
      args.appInstances || this.appInstances,
      args.freeBalanceAppInstance || this.freeBalanceAppInstance,
      args.monotonicNumProposedApps || this.monotonicNumProposedApps,
      args.schemaVersion || this.schemaVersion,
    );
  };

  public addActiveAppAndIncrementFreeBalance(
    activeApp: string,
    tokenIndexedIncrements: TokenIndexedCoinTransferMap,
  ) {
    return this.build({
      freeBalanceAppInstance: this.getFreeBalanceClass()
        .increment(tokenIndexedIncrements)
        .addActiveApp(activeApp)
        .toAppInstance(this.freeBalance),
    });
  }

  public removeActiveAppAndIncrementFreeBalance(
    activeApp: string,
    tokenIndexedIncrements: TokenIndexedCoinTransferMap,
  ) {
    return this.build({
      freeBalanceAppInstance: this.getFreeBalanceClass()
        .removeActiveApp(activeApp)
        .increment(tokenIndexedIncrements)
        .toAppInstance(this.freeBalance),
    });
  }

  public setFreeBalance(newFreeBalanceClass: FreeBalanceClass) {
    const oldApp = this.freeBalance;
    return this.build({
      freeBalanceAppInstance: newFreeBalanceClass.toAppInstance(oldApp),
    });
  }

  public static setupChannel(
    freeBalanceAppAddress: string,
    addresses: CriticalStateChannelAddresses,
    multisigAddress: string,
    initiatorId: PublicIdentifier,
    responderId: PublicIdentifier,
    freeBalanceTimeout?: number,
  ) {
    return new StateChannel(
      multisigAddress,
      addresses,
      initiatorId,
      responderId,
      new Map<string, AppInstanceJson>([]),
      new Map<string, AppInstance>([]),
      createFreeBalance(
        initiatorId,
        responderId,
        freeBalanceAppAddress,
        freeBalanceTimeout || HARD_CODED_ASSUMPTIONS.freeBalanceDefaultTimeout,
        multisigAddress,
      ),
      1, // num proposed apps
    );
  }

  public static createEmptyChannel(
    multisigAddress: string,
    addresses: CriticalStateChannelAddresses,
    initiatorId: string,
    responderId: string,
  ) {
    return new StateChannel(
      multisigAddress,
      addresses,
      initiatorId,
      responderId,
      new Map<string, AppInstanceJson>([]),
      new Map<string, AppInstance>(),
      // Note that this FreeBalance is undefined because a channel technically
      // does not have a FreeBalance before the `setup` protocol gets run
      undefined,
      1,
    );
  }

  public addProposal(proposal: AppInstanceJson) {
    const proposedAppInstances = new Map<string, AppInstanceJson>(
      this.proposedAppInstances.entries(),
    );

    proposedAppInstances.set(proposal.identityHash, proposal);

    return this.build({
      proposedAppInstances,
      monotonicNumProposedApps: this.monotonicNumProposedApps + 1,
    });
  }

  public removeProposal = (appIdentityHash: string) => {
    const proposedAppInstances = new Map<string, AppInstanceJson>(
      this.proposedAppInstances.entries(),
    );

    proposedAppInstances.delete(appIdentityHash);

    return this.build({
      proposedAppInstances,
    });
  };

  public addAppInstance(appInstance: AppInstance) {
    const appInstances = new Map<string, AppInstance>(this.appInstances.entries());

    appInstances.set(appInstance.identityHash, appInstance);

    return this.build({
      appInstances,
    });
  }

  public removeAppInstance(appIdentityHash: string) {
    const appInstances = new Map<string, AppInstance>(this.appInstances.entries());

    appInstances.delete(appIdentityHash);

    return this.build({
      appInstances,
    });
  }

  public setState(
    appInstance: AppInstance,
    state: SolidityValueType,
    stateTimeout: BigNumber = toBN(appInstance.defaultTimeout),
  ) {
    const appInstances = new Map<string, AppInstance>(this.appInstances.entries());

    appInstances.set(appInstance.identityHash, appInstance.setState(state, stateTimeout));

    return this.build({
      appInstances,
    });
  }

  public installApp(appInstance: AppInstance, tokenIndexedDecrements: TokenIndexedCoinTransferMap) {
    // Verify appInstance has expected signingkeys
    const proposal = this.proposedAppInstances.has(appInstance.identityHash)
      ? this.proposedAppInstances.get(appInstance.identityHash)
      : undefined;

    if (!proposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_IDENTITY_HASH(appInstance.identityHash));
    }

    /// Add modified FB and new AppInstance to appInstances
    const appInstances = new Map<string, AppInstance>(this.appInstances.entries());

    appInstances.set(appInstance.identityHash, appInstance);

    const proposedAppInstances = this.removeProposal(appInstance.identityHash).proposedAppInstances;

    return this.build({
      appInstances,
      proposedAppInstances,
    }).addActiveAppAndIncrementFreeBalance(
      appInstance.identityHash,
      flipTokenIndexedBalances(tokenIndexedDecrements),
    );
  }

  public uninstallApp(
    appToBeUninstalled: AppInstance,
    tokenIndexedIncrements: TokenIndexedCoinTransferMap,
  ) {
    const appInstances = new Map<string, AppInstance>(this.appInstances.entries());

    if (!appInstances.delete(appToBeUninstalled.identityHash)) {
      throw Error(
        `Consistency error: managed to call get on ${appToBeUninstalled.identityHash} but failed to call delete`,
      );
    }

    return this.build({
      appInstances,
    }).removeActiveAppAndIncrementFreeBalance(
      appToBeUninstalled.identityHash,
      tokenIndexedIncrements,
    );
  }

  toJson(): StateChannelJSON {
    return deBigNumberifyJson({
      multisigAddress: this.multisigAddress,
      addresses: this.addresses,
      userIdentifiers: this.userIdentifiers,
      proposedAppInstances: [...this.proposedAppInstances.entries()],
      appInstances: [...this.appInstances.entries()].map((appInstanceEntry): [
        string,
        AppInstanceJson,
      ] => {
        return [appInstanceEntry[0], appInstanceEntry[1].toJson()];
      }),

      // Note that this FreeBalance can be undefined because a channel technically
      // does not have a FreeBalance before the `setup` protocol gets run
      freeBalanceAppInstance: this.freeBalanceAppInstance
        ? this.freeBalanceAppInstance.toJson()
        : null,
      monotonicNumProposedApps: this.monotonicNumProposedApps,
      schemaVersion: this.schemaVersion,
    });
  }

  /**
   * The state channel JSON object should *always* have an associated proxy
   * bytecode. There is no case where a JSON version of a state channel is
   * created that did *not* have an associated bytecode with it
   *
   */
  static fromJson(json: StateChannelJSON): StateChannel {
    const dropNulls = (arr: any[] | undefined) => {
      if (arr) {
        return arr.filter((x: any) => !!x);
      }
      return arr;
    };
    try {
      return new StateChannel(
        json.multisigAddress,
        json.addresses,
        json.userIdentifiers[0], // initiator
        json.userIdentifiers[1], // responder
        new Map(
          [...Object.values(dropNulls(json.proposedAppInstances) || [])].map((proposal): [
            string,
            AppInstanceJson,
          ] => {
            return [proposal[0], proposal[1]];
          }),
        ),
        new Map(
          [...Object.values(dropNulls(json.appInstances) || [])].map((appInstanceEntry): [
            string,
            AppInstance,
          ] => {
            return [appInstanceEntry[0], AppInstance.fromJson(appInstanceEntry[1])];
          }),
        ),
        json.freeBalanceAppInstance ? AppInstance.fromJson(json.freeBalanceAppInstance) : undefined,
        json.monotonicNumProposedApps,
        json.schemaVersion,
      );
    } catch (e) {
      throw new Error(`could not create state channel from json: ${stringify(json)}. Error: ${e}`);
    }
  }

  static async getPeersAddressFromChannel(
    myIdentifier: string,
    store: IStoreService,
    multisigAddress: string,
  ): Promise<string[]> {
    const stateChannel = await store.getStateChannel(multisigAddress);
    if (!stateChannel) {
      throw new Error(
        `[getPeersAddressFromChannel] No state channel found in store for ${multisigAddress}`,
      );
    }
    const owners = stateChannel.userIdentifiers;
    return owners.filter((owner) => owner !== myIdentifier);
  }
}
