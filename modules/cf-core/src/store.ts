import { AppInstanceJson } from "@connext/types";
import { BaseProvider } from "ethers/providers";

import {
  NO_MULTISIG_FOR_APP_INSTANCE_ID,
  NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID,
  NO_STATE_CHANNEL_FOR_MULTISIG_ADDR,
  NO_MULTISIG_FOR_COUNTERPARTIES,
  NO_STATE_CHANNEL_FOR_APP_INSTANCE_ID,
  NO_STATE_CHANNEL_FOR_OWNERS,
} from "./methods";
import { AppInstance, AppInstanceProposal, StateChannel } from "./models";
import { CFCoreTypes } from "./types";
import { getCreate2MultisigAddress, prettyPrintObject } from "./utils";
import { SetStateCommitment, ConditionalTransactionCommitment } from "./ethereum";

/**
 * A simple ORM around StateChannels and AppInstances stored using the
 * StoreService.
 */
export class Store {
  constructor(private readonly storeService: CFCoreTypes.IStoreService) {}

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
      throw Error(NO_STATE_CHANNEL_FOR_OWNERS(owners.toString()));
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
    // make sure state channel does not already exist
    const existing = await this.getStateChannelIfExists(stateChannel.multisigAddress);
    if (existing) {
      throw new Error(
        `Should only call 'saveStateChannel' during setup protocol, found state channel: ${prettyPrintObject(
          existing,
        )}`,
      );
    }
    await this.storeService.saveStateChannel(stateChannel.toJson());
    if (!stateChannel.hasFreeBalance) {
      return;
    }
    await this.storeService.saveFreeBalance(
      stateChannel.multisigAddress,
      stateChannel.freeBalance.toJson(),
    );
  }

  private async assertChannelExists(multisigAddress: string) {
    // make sure state channel does not already exist
    const existing = await this.getStateChannelIfExists(multisigAddress);
    if (!existing) {
      throw new Error(`Setup protocol has not been run`);
    }
  }

  /**
   * This persists the state of the free balance
   * @param appInstance
   */
  public async saveFreeBalance(channel: StateChannel) {
    await this.storeService.saveFreeBalance(channel.multisigAddress, channel.freeBalance.toJson());
  }

  /**
   * Returns the proposed AppInstance with the specified appInstanceId.
   */
  public async getAppInstanceProposal(appInstanceId: string): Promise<AppInstanceProposal> {
    const proposal = await this.storeService.getAppProposal(appInstanceId);
    if (!proposal) {
      throw new Error(NO_PROPOSED_APP_INSTANCE_FOR_APP_INSTANCE_ID(appInstanceId));
    }

    return proposal;
  }

  /**
   * This persists the state of an app proposal
   */
  public async saveAppProposal(channel: StateChannel, proposal: AppInstanceProposal) {
    await this.assertChannelExists(channel.multisigAddress);
    if (proposal.identityHash === channel.freeBalance.identityHash) {
      throw new Error(`Free balance does not go through proposal flow`);
    }
    if (!channel.hasAppProposal(proposal.identityHash)) {
      throw new Error(`Post protocol channel does not have proposal, did 'propose' protocol fail?`);
    }
    // the nonce will be updated on proposal, so make sure to save the
    // state channel here as well
    await this.storeService.saveStateChannel(channel.toJson());
    await this.storeService.saveAppProposal(channel.multisigAddress, proposal);
  }

  /**
   * This persists the state of an app instance
   */
  public async removeAppProposal(channel: StateChannel, app: AppInstanceProposal) {
    await this.assertChannelExists(channel.multisigAddress);
    if (channel.hasAppProposal(app.identityHash)) {
      throw new Error(`Post protocol channel still has proposal, did protocol fail?`);
    }
    await this.storeService.removeAppProposal(channel.multisigAddress, app.identityHash);
  }

  /**
   * This persists the state of an app instance
   */
  public async saveAppInstance(channel: StateChannel, app: AppInstance) {
    await this.assertChannelExists(channel.multisigAddress);
    if (channel.hasAppProposal(app.identityHash)) {
      throw new Error(`Post protocol channel still has proposal, did 'install' protocol fail?`);
    }
    if (app.identityHash === channel.freeBalance.identityHash) {
      throw new Error(`Save free balance using 'saveFreeBalance'`);
    }
    // make sure that it has app instance in channel object
    if (!channel.hasAppInstance(app.identityHash)) {
      throw new Error(`Post protocol channel does not have instance, did 'install' protocol fail?`);
    }
    // check if proposal must be removed
    if (await this.storeService.getAppProposal(app.identityHash)) {
      // proposal does exist in the store, remove it
      await this.storeService.removeAppProposal(channel.multisigAddress, app.identityHash);
    }
    await this.storeService.saveAppInstance(channel.multisigAddress, app.toJson());
  }

  /**
   * This persists the state of an app instance
   */
  public async removeAppInstance(channel: StateChannel, app: AppInstance) {
    // make sure that it has app instance in channel object
    if (channel.hasAppInstance(app.identityHash)) {
      throw new Error(`Post protocol channel still has instance, did 'uninstall' protocol fail?`);
    }
    await this.storeService.removeAppInstance(channel.multisigAddress, app.identityHash);
  }

  /**
   * Returns a list of proposed `AppInstanceProposals`s.
   */
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

  public async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<CFCoreTypes.MinimalTransaction> {
    const withdrawalCommitment = await this.storeService.getWithdrawalCommitment(multisigAddress);
    if (!withdrawalCommitment) {
      throw new Error("Could not find withdrawal commitment");
    }
    return withdrawalCommitment;
  }

  public async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: CFCoreTypes.MinimalTransaction,
  ) {
    return this.storeService.saveWithdrawalCommitment(multisigAddress, commitment);
  }

  public async getSetupCommitment(
    multisigAddress: string,
  ): Promise<CFCoreTypes.MinimalTransaction> {
    const withdrawalCommitment = await this.storeService.getSetupCommitment(multisigAddress);
    if (!withdrawalCommitment) {
      throw new Error("Could not find setup commitment");
    }
    return withdrawalCommitment;
  }

  public async saveSetupCommitment(
    multisigAddress: string,
    commitment: CFCoreTypes.MinimalTransaction,
  ) {
    return this.storeService.saveSetupCommitment(multisigAddress, commitment);
  }

  public async getLatestSetStateCommitment(
    appInstanceId: string,
  ): Promise<SetStateCommitment | undefined> {
    const json = await this.storeService.getLatestSetStateCommitment(appInstanceId);
    if (!json) {
      return undefined;
    }
    return SetStateCommitment.fromJson(json);
  }

  public async saveLatestSetStateCommitment(
    appInstanceId: string,
    commitment: SetStateCommitment,
  ): Promise<void> {
    return this.storeService.saveLatestSetStateCommitment(appInstanceId, commitment.toJson());
  }

  public async getConditionalTransactionCommitment(
    appInstanceId: string,
  ): Promise<ConditionalTransactionCommitment | undefined> {
    const json = await this.storeService.getConditionalTransactionCommitment(appInstanceId);
    if (!json) {
      return undefined;
    }
    return ConditionalTransactionCommitment.fromJson(json);
  }

  public async saveConditionalTransactionCommitment(
    appInstanceId: string,
    commitment: ConditionalTransactionCommitment, // ConditionalTransactionJSON,
  ): Promise<void> {
    return this.storeService.saveConditionalTransactionCommitment(
      appInstanceId,
      commitment.toJson(),
    );
  }

  public async getAppInstance(appInstanceId: string): Promise<AppInstance> {
    const channel = await this.getStateChannelFromAppInstanceID(appInstanceId);
    return channel.getAppInstance(appInstanceId);
  }
}
