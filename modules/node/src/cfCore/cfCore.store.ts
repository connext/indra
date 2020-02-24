import { Injectable } from "@nestjs/common";
import { IStoreService, StateChannelJSON, AppInstanceJson, ProtocolTypes } from "@connext/types";

import { ChannelRepository } from "../channel/channel.repository";

@Injectable()
export class CFCoreStore implements IStoreService {
  constructor(private readonly channelRepository: ChannelRepository) {}

  async getAllChannels(): Promise<StateChannelJSON[]> {
    const channels = await this.channelRepository.findAll();
  }
  getStateChannel(multisigAddress: string): Promise<StateChannelJSON> {
    throw new Error("Method not implemented.");
  }
  getStateChannelByOwners(owners: string[]): Promise<StateChannelJSON> {
    throw new Error("Method not implemented.");
  }
  getStateChannelByAppInstanceId(appInstanceId: string): Promise<StateChannelJSON> {
    throw new Error("Method not implemented.");
  }
  saveStateChannel(stateChannel: StateChannelJSON): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getAppInstance(appInstanceId: string): Promise<AppInstanceJson> {
    throw new Error("Method not implemented.");
  }
  saveAppInstance(multisigAddress: string, appInstance: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getCommitment(commitmentHash: string): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }
  saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getWithdrawalCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    throw new Error("Method not implemented.");
  }
  saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getExtendedPrvKey(): Promise<string> {
    throw new Error("Method not implemented.");
  }
  saveExtendedPrvKey(extendedPrvKey: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  restore(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
