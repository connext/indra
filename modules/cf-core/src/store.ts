import { StateChannelJSON, AppInstanceJson } from "@connext/types";
import { BaseProvider } from "ethers/providers";
import { solidityKeccak256 } from "ethers/utils";

import {
  DB_NAMESPACE_ALL_COMMITMENTS,
  DB_NAMESPACE_CHANNEL,
  DB_NAMESPACE_WITHDRAWALS
} from "./db-schema";
import {
  NO_MULTISIG_FOR_APP_INSTANCE_ID,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
  NO_MULTISIG_FOR_COUNTERPARTIES
} from "./methods/errors";
import { AppInstance, AppInstanceProposal, StateChannel } from "./models";
import { CFCoreTypes, SolidityValueType } from "./types";
import { getCreate2MultisigAddress } from "./utils";

/**
 * A simple ORM around StateChannels and AppInstances stored using the
 * StoreService.
 */
export class Store {
  constructor(
    private readonly storeService: CFCoreTypes.IStoreService,
    private readonly storeKeyPrefix: string
  ) {}

  // TODO: remove if store is added to Context type
  public static async getMultisigAddressWithCounterpartyFromMap(
    stateChannelsMap: Map<string, StateChannel>,
    owners: string[],
    proxyFactoryAddress: string,
    minimumViableMultisigAddress: string,
    provider?: BaseProvider
  ): Promise<string> {
    for (const stateChannel of stateChannelsMap.values()) {
      if (
        stateChannel.userNeuteredExtendedKeys.sort().toString() ===
        owners.sort().toString()
      ) {
        return stateChannel.multisigAddress;
      }
    }
    if (provider) {
      return await getCreate2MultisigAddress(
        owners,
        proxyFactoryAddress,
        minimumViableMultisigAddress,
        provider
      );
    }
    throw new Error(NO_MULTISIG_FOR_COUNTERPARTIES(owners));
  }

  public async getMultisigAddressWithCounterparty(
    owners: string[],
    proxyFactoryAddress: string,
    minimumViableMultisigAddress: string,
    provider?: BaseProvider
  ) {
    const stateChannelsMap = await this.getStateChannelsMap();
    return await Store.getMultisigAddressWithCounterpartyFromMap(
      stateChannelsMap,
      owners,
      proxyFactoryAddress,
      minimumViableMultisigAddress,
      provider
    );
  }

  /**
   * Returns an object with the keys being the multisig addresses and the
   * values being `StateChannel` instances.
   */
  public async getStateChannelsMap(): Promise<Map<string, StateChannel>> {
    const channelsJSON = ((await this.storeService.get(
      `${this.storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}`
    )) || {}) as { [multisigAddress: string]: StateChannelJSON };

    return new Map(
      Object.values(channelsJSON)
        .map(StateChannel.fromJson)
        .map(sc => [sc.multisigAddress, sc])
    );
  }

  /**
   * Returns the StateChannel instance with the specified multisig address.
   * @param multisigAddress
   */
  public async getStateChannel(multisigAddress: string): Promise<StateChannel> {
    const stateChannelJson = await this.storeService.get(
      `${this.storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}/${multisigAddress}`
    );

    if (!stateChannelJson) {
      throw Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    const channel = StateChannel.fromJson(stateChannelJson);
    return channel;
  }

  /**
   * Checks if a StateChannel is in the store
   */
  public async hasStateChannel(multisigAddress: string): Promise<boolean> {
    return !!(await this.storeService.get(
      `${this.storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}/${multisigAddress}`
    ));
  }

  /**
   * Returns a string identifying the multisig address the specified app instance
   * belongs to.
   * @param appInstanceId
   */
  public async getMultisigAddressFromAppInstance(
    appInstanceId: string
  ): Promise<string> {
    for (const sc of (await this.getStateChannelsMap()).values()) {
      if (
        sc.proposedAppInstances.has(appInstanceId) ||
        sc.appInstances.has(appInstanceId) ||
        (sc.hasFreeBalance && sc.freeBalance.identityHash === appInstanceId)
      ) {
        return sc.multisigAddress;
      }
    }

    throw new Error(NO_MULTISIG_FOR_APP_INSTANCE_ID);
  }

  /**
   * This persists the state of a channel.
   * @param stateChannel
   */
  public async saveStateChannel(stateChannel: StateChannel) {
    await this.storeService.set([
      {
        path: `${this.storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}/${stateChannel.multisigAddress}`,
        value: stateChannel.toJson()
      }
    ]);
  }

  /**
   * This persists the state of the given AppInstance.
   * @param appInstance
   */
  public async saveAppInstanceState(
    appInstanceId: string,
    newState: SolidityValueType
  ) {
    const channel = await this.getChannelFromAppInstanceID(appInstanceId);
    const updatedChannel = await channel.setState(appInstanceId, newState);
    await this.saveStateChannel(updatedChannel);
  }

  /**
   * Returns a list of proposed `AppInstanceProposals`s.
   */
  public async getProposedAppInstances(
    multisigAddress?: string
  ): Promise<AppInstanceProposal[]> {
    const chanArray = multisigAddress
      ? [await this.getStateChannel(multisigAddress)]
      : [...(await this.getStateChannelsMap()).values()];
    return chanArray.reduce(
      (lst, sc) => [...lst, ...sc.proposedAppInstances.values()],
      [] as AppInstanceProposal[]
    );
  }

  /**
   * Returns a list of proposed `AppInstanceJson`s.
   */
  public async getAppInstances(
    multisigAddress?: string
  ): Promise<AppInstanceJson[]> {
    const chanArray = multisigAddress
      ? [await this.getStateChannel(multisigAddress)]
      : [...(await this.getStateChannelsMap()).values()];
    return chanArray.reduce((acc: AppInstanceJson[], channel: StateChannel) => {
      acc.push(
        ...Array.from(channel.appInstances.values()).map(appInstance =>
          appInstance.toJson()
        )
      );
      return acc;
    }, []);
  }

  /**
   * Returns the proposed AppInstance with the specified appInstanceId.
   */
  public async getAppInstanceProposal(
    appInstanceId: string
  ): Promise<AppInstanceProposal> {
    const multisigAddress = await this.getMultisigAddressFromAppInstance(
      appInstanceId
    );

    if (!multisigAddress) {
      throw new Error(
        NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId)
      );
    }

    const stateChannel = await this.getStateChannel(multisigAddress);

    if (!stateChannel.proposedAppInstances.has(appInstanceId)) {
      throw new Error(
        NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId)
      );
    }

    return stateChannel.proposedAppInstances.get(appInstanceId)!;
  }

  /**
   * @param appInstanceId
   */
  public async getChannelFromAppInstanceID(
    appInstanceId: string
  ): Promise<StateChannel> {
    return await this.getStateChannel(
      await this.getMultisigAddressFromAppInstance(appInstanceId)
    );
  }

  public async getWithdrawalCommitment(
    multisigAddress: string
  ): Promise<CFCoreTypes.MinimalTransaction> {
    return this.storeService.get(
      [this.storeKeyPrefix, DB_NAMESPACE_WITHDRAWALS, multisigAddress].join("/")
    );
  }

  public async storeWithdrawalCommitment(
    multisigAddress: string,
    commitment: CFCoreTypes.MinimalTransaction
  ) {
    return this.storeService.set([
      {
        path: [
          this.storeKeyPrefix,
          DB_NAMESPACE_WITHDRAWALS,
          multisigAddress
        ].join("/"),
        value: commitment
      }
    ]);
  }

  public async setCommitment(args: any[], commitment: CFCoreTypes.MinimalTransaction) {
    return this.storeService.set([
      {
        path: [
          this.storeKeyPrefix,
          DB_NAMESPACE_ALL_COMMITMENTS,
          solidityKeccak256(
            ["address", "uint256", "bytes"],
            [commitment.to, commitment.value, commitment.data]
          )
        ].join("/"),
        value: args.concat([commitment])
      }
    ]);
  }

  public async getAppInstance(appInstanceId: string): Promise<AppInstance> {
    const channel = await this.getChannelFromAppInstanceID(appInstanceId);
    return channel.getAppInstance(appInstanceId);
  }

  public async getOrCreateStateChannelBetweenVirtualAppParticipants(
    multisigAddress: string,
    proxyFactoryAddress: string,
    initiatorXpub: string,
    responderXpub: string
  ): Promise<StateChannel> {
    try {
      return await this.getStateChannel(multisigAddress);
    } catch (e) {
      if (
        e
          .toString()
          .includes(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress))
      ) {
        const stateChannel = StateChannel.createEmptyChannel(
          multisigAddress,
          proxyFactoryAddress,
          [initiatorXpub, responderXpub]
        );

        await this.saveStateChannel(stateChannel);

        return stateChannel;
      }

      throw Error(e);
    }
  }
}
