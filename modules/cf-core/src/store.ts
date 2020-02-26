import { CriticalStateChannelAddresses, AppInstanceJson } from "@connext/types";
import { BaseProvider } from "ethers/providers";
import { solidityKeccak256 } from "ethers/utils";

import {
  NO_MULTISIG_FOR_APP_INSTANCE_ID,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
  NO_MULTISIG_FOR_COUNTERPARTIES,
  NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID,
} from "./methods/errors";
import { AppInstance, AppInstanceProposal, StateChannel } from "./models";
import { CFCoreTypes, SolidityValueType } from "./types";
import { getCreate2MultisigAddress } from "./utils";
import { SetStateCommitment } from "./ethereum";

/**
 * A simple ORM around StateChannels and AppInstances stored using the
 * StoreService.
 */
export class Store {
  constructor(
    private readonly storeService: CFCoreTypes.IStoreService,
    private readonly storeKeyPrefix: string,
  ) {}

  public async getMultisigAddressWithCounterparty(
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
        return await getCreate2MultisigAddress(
          owners,
          { proxyFactory, multisigMastercopy },
          provider,
        );
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

    return StateChannel.fromJson(stateChannelJson);
  }

  /**
   * Returns the StateChannel instance with the specified multisig address.
   * @param multisigAddress
   */
  public async getStateChannelIfExists(multisigAddress: string): Promise<StateChannel | undefined> {
    const stateChannelJson = await this.storeService.getStateChannel(multisigAddress);

    if (!stateChannelJson) {
      return undefined;
    }

    return StateChannel.fromJson(stateChannelJson);
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
   * @param appInstanceId
   */
  public async getStateChannelFromAppInstanceID(appInstanceId: string): Promise<StateChannel> {
    const stateChannelJson = await this.storeService.getStateChannelByAppInstanceId(appInstanceId);

    if (!stateChannelJson) {
      throw Error(NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    const channel = StateChannel.fromJson(stateChannelJson);
    return channel;
  }

  public async getAllChannels(): Promise<StateChannel[]> {
    return (await this.storeService.getAllChannels()).map(StateChannel.fromJson);
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
    await this.storeService.saveStateChannel(stateChannel.toJson());
  }

  /**
   * This persists the state of the given AppInstance.
   * @param appInstance
   */
  public async saveAppInstanceState(appInstanceId: string, newState: SolidityValueType) {
    const channel = await this.getStateChannelFromAppInstanceID(appInstanceId);
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
    const stateChannel = await this.getStateChannelFromAppInstanceID(appInstanceId);

    if (!stateChannel.proposedAppInstances.has(appInstanceId)) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    return stateChannel.proposedAppInstances.get(appInstanceId)!;
  }

  public async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<CFCoreTypes.MinimalTransaction> {
    const withdrawalCommitment = await this.storeService.getWithdrawalCommitment(multisigAddress);
    if (!withdrawalCommitment) {
      throw new Error("Could not find withdrawal commitment");
    }
    return withdrawalCommitment;
  }

  public async storeWithdrawalCommitment(
    multisigAddress: string,
    commitment: CFCoreTypes.MinimalTransaction,
  ) {
    return this.storeService.saveWithdrawalCommitment(multisigAddress, commitment);
  }

  public async setCommitment(args: any[], commitment: CFCoreTypes.MinimalTransaction) {
    return this.storeService.saveCommitment(
      solidityKeccak256(
        ["address", "uint256", "bytes"],
        [commitment.to, commitment.value, commitment.data],
      ),
      args.concat([commitment]),
    );
  }

  public async saveLatestSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitment,
  ): Promise<void> {
    return this.storeService.saveLatestSetStateCommitment(appInstanceId, commitment.toJson());
  }

  public async getAppInstance(appInstanceId: string): Promise<AppInstance> {
    const channel = await this.getStateChannelFromAppInstanceID(appInstanceId);
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
