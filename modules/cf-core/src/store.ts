import { CriticalStateChannelAddresses, AppInstanceJson } from "@connext/types";
import { BaseProvider } from "ethers/providers";
import { solidityKeccak256 } from "ethers/utils";

import { DB_NAMESPACE_ALL_COMMITMENTS, DB_NAMESPACE_CHANNEL, DB_NAMESPACE_WITHDRAWALS } from "./db-schema";
import {
  NO_MULTISIG_FOR_APP_INSTANCE_ID,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
  NO_MULTISIG_FOR_COUNTERPARTIES,
} from "./methods/errors";
import { AppInstance, AppInstanceProposal, StateChannel } from "./models";
import { CFCoreTypes, SolidityValueType } from "./types";
import { getCreate2MultisigAddress } from "./utils";

/**
 * A simple ORM around StateChannels and AppInstances stored using the
 * StoreService.
 */
export class Store {
  constructor(private readonly storeService: CFCoreTypes.IStoreServiceNew, private readonly storeKeyPrefix: string) {}

  public async getMultisigAddressWithCounterpartyFromStore(
    owners: string[],
    proxyFactory: string,
    multisigMastercopy: string,
    provider?: BaseProvider,
  ): Promise<string> {
    try {
      const stateChannel = await this.getStateChannelByOwners(owners);
      return stateChannel.multisigAddress;
    } catch (e) {
      if (provider) {
        return await getCreate2MultisigAddress(owners, { proxyFactory, multisigMastercopy }, provider);
      }
    }
    throw new Error(NO_MULTISIG_FOR_COUNTERPARTIES(owners));
  }

  /**
   * Returns the StateChannel instance with the specified multisig address.
   * @param multisigAddress
   */
  public async getStateChannel(multisigAddress: string): Promise<StateChannel> {
    const stateChannelJson = await this.storeService.getStateChannel(multisigAddress);

    if (!stateChannelJson) {
      throw Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress));
    }

    const channel = StateChannel.fromJson(stateChannelJson);
    return channel;
  }

  /**
   * Returns the StateChannel instance with the specified multisig address.
   * @param multisigAddress
   */
  public async getStateChannelByOwners(owners: string[]): Promise<StateChannel> {
    const stateChannelJson = await this.storeService.getStateChannelByOwners(owners.sort());

    if (!stateChannelJson) {
      throw Error(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(owners.toString()));
    }

    const channel = StateChannel.fromJson(stateChannelJson);
    return channel;
  }

  /**
   * Checks if a StateChannel is in the store
   */
  public async hasStateChannel(multisigAddress: string): Promise<boolean> {
    return !!(await this.storeService.getStateChannel(multisigAddress));
  }

  /**
   * Returns a string identifying the multisig address the specified app instance
   * belongs to.
   * @param appInstanceId
   */
  public async getMultisigAddressFromAppInstance(appInstanceId: string): Promise<string> {
    const stateChannel = await this.storeService.getStateChannelByAppInstanceId(appInstanceId);
    if (stateChannel) {
      return stateChannel.multisigAddress;
    }
    throw new Error(NO_MULTISIG_FOR_APP_INSTANCE_ID);
  }

  /**
   * This persists the state of a channel.
   * @param stateChannel
   */
  public async saveStateChannel(stateChannel: StateChannel) {
    await this.storeService.saveStateChannel(stateChannel.toJson())
  }

  /**
   * This persists the state of the given AppInstance.
   * @param appInstance
   */
  public async saveAppInstanceState(appInstanceId: string, newState: SolidityValueType) {
    const channel = await this.getChannelFromAppInstanceID(appInstanceId);
    const updatedChannel = channel.setState(appInstanceId, newState);
    await this.saveStateChannel(updatedChannel);
  }

  /**
   * Returns a list of proposed `AppInstanceProposals`s.
   */
  // TODO: make sure this isn't being called to get all channels
  public async getProposedAppInstances(multisigAddress: string): Promise<AppInstanceProposal[]> {
    const sc = await this.getStateChannel(multisigAddress);
    return [...sc.proposedAppInstances.values()];
  }

  /**
   * Returns a list of proposed `AppInstanceJson`s.
   */
  public async getAppInstances(multisigAddress: string): Promise<AppInstanceJson[]> {
    const sc = await this.getStateChannel(multisigAddress);
    return [...sc.appInstances.values()].map(appInstance => appInstance.toJson());
  }

  /**
   * Returns the proposed AppInstance with the specified appInstanceId.
   */
  public async getAppInstanceProposal(appInstanceId: string): Promise<AppInstanceProposal> {
    const multisigAddress = await this.getMultisigAddressFromAppInstance(appInstanceId);

    if (!multisigAddress) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    const stateChannel = await this.getStateChannel(multisigAddress);

    if (!stateChannel.proposedAppInstances.has(appInstanceId)) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    return stateChannel.proposedAppInstances.get(appInstanceId)!;
  }

  /**
   * @param appInstanceId
   */
  public async getChannelFromAppInstanceID(appInstanceId: string): Promise<StateChannel> {
    return await this.getStateChannel(await this.getMultisigAddressFromAppInstance(appInstanceId));
  }

  public async getWithdrawalCommitment(multisigAddress: string): Promise<CFCoreTypes.MinimalTransaction> {
    return this.storeService.get([this.storeKeyPrefix, DB_NAMESPACE_WITHDRAWALS, multisigAddress].join("/"));
  }

  public async storeWithdrawalCommitment(multisigAddress: string, commitment: CFCoreTypes.MinimalTransaction) {
    return this.storeService.set([
      {
        path: [this.storeKeyPrefix, DB_NAMESPACE_WITHDRAWALS, multisigAddress].join("/"),
        value: commitment,
      },
    ]);
  }

  public async setCommitment(args: any[], commitment: CFCoreTypes.MinimalTransaction) {
    return this.storeService.set([
      {
        path: [
          this.storeKeyPrefix,
          DB_NAMESPACE_ALL_COMMITMENTS,
          solidityKeccak256(["address", "uint256", "bytes"], [commitment.to, commitment.value, commitment.data]),
        ].join("/"),
        value: args.concat([commitment]),
      },
    ]);
  }

  public async getAppInstance(appInstanceId: string): Promise<AppInstance> {
    const channel = await this.getChannelFromAppInstanceID(appInstanceId);
    return channel.getAppInstance(appInstanceId);
  }

  public async getOrCreateStateChannelBetweenVirtualAppParticipants(
    multisigAddress: string,
    addresses: CriticalStateChannelAddresses,
    initiatorXpub: string,
    responderXpub: string,
  ): Promise<StateChannel> {
    try {
      return await this.getStateChannel(multisigAddress);
    } catch (e) {
      if (e.toString().includes(NO_STATE_CHANNEL_FOR_MULTISIG_ADDR(multisigAddress))) {
        const stateChannel = StateChannel.createEmptyChannel(multisigAddress, addresses, [
          initiatorXpub,
          responderXpub,
        ]);

        await this.saveStateChannel(stateChannel);

        return stateChannel;
      }

      throw Error(e);
    }
  }
}
