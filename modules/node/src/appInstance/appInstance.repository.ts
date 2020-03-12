import { AppInstanceJson, AppInstanceProposal } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { AppInstance, AppType } from "./appInstance.entity";
import { bigNumberify } from "ethers/utils";

export const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  if (!app) {
    return undefined;
  }
  return {
    appInterface: {
      stateEncoding: app.abiEncodings.stateEncoding,
      actionEncoding: app.abiEncodings.actionEncoding || undefined,
      addr: app.appDefinition,
    },
    appSeqNo: app.appSeqNo,
    defaultTimeout: bigNumberify(app.timeout).toNumber(),
    identityHash: app.identityHash,
    isVirtualApp: false, // hardcode
    latestState: app.latestState,
    latestTimeout: app.latestTimeout,
    latestVersionNumber: app.latestVersionNumber,
    multisigAddress: channel.multisigAddress,
    outcomeType: (app.outcomeType as unknown) as number,
    participants: app.participants,
    multiAssetMultiPartyCoinTransferInterpreterParams:
      app.multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams:
      app.singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams: app.twoPartyOutcomeInterpreterParams,
  };
};

export const convertAppToProposedInstanceJSON = (app: AppInstance): AppInstanceProposal => {
  return {
    abiEncodings: app.abiEncodings,
    appDefinition: app.appDefinition,
    appSeqNo: app.appSeqNo,
    identityHash: app.identityHash,
    initialState: app.initialState,
    initiatorDeposit: app.initiatorDeposit.toHexString(),
    initiatorDepositTokenAddress: app.initiatorDepositTokenAddress,
    outcomeType: app.outcomeType,
    proposedByIdentifier: app.proposedByIdentifier,
    proposedToIdentifier: app.proposedToIdentifier,
    responderDeposit: app.responderDeposit.toHexString(),
    responderDepositTokenAddress: app.responderDepositTokenAddress,
    timeout: bigNumberify(app.timeout).toHexString(),
    intermediaryIdentifier: null, // hardcode
    multiAssetMultiPartyCoinTransferInterpreterParams:
      app.multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams:
      app.singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams: app.twoPartyOutcomeInterpreterParams,
  };
};

@EntityRepository(AppInstance)
export class AppInstanceRepository extends Repository<AppInstance> {
  findByIdentityHash(identityHash: string): Promise<AppInstance | undefined> {
    return this.findOne({
      where: {
        identityHash,
      },
      relations: ["channel"],
    });
  }

  findByMultisigAddressAndType(multisigAddress: string, type: AppType): Promise<AppInstance[]> {
    return this.createQueryBuilder("app_instances")
      .leftJoinAndSelect(
        "app_instances.channel",
        "channel",
        "channel.multisigAddress = :multisigAddress",
        { multisigAddress },
      )
      .where("app_instance.type = :type", { type })
      .getMany();
    // return this.findOne({
    //   where: {
    //     type,
    //   },
    //   relations: ["channel"],
    // });
  }

  async getAppProposal(appInstanceId: string): Promise<AppInstanceProposal | undefined> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app || app.type !== AppType.PROPOSAL) {
      return undefined;
    }
    return convertAppToProposedInstanceJSON(app);
  }

  saveAppProposal(appInstanceId: string, appProposal: AppInstanceProposal): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByMultisigAddressAndType(multisigAddress, AppType.FREE_BALANCE);
    if (!app || app.length === 0) {
      return undefined;
    }
    if (app.length > 1) {
      throw new Error(`Multiple free balance apps found for ${multisigAddress}`);
    }
    return convertAppToInstanceJSON(app[0], app[0].channel);
  }

  saveFreeBalance(multisigAddress: string, freeBalance: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app) {
      return undefined;
    }
    return convertAppToInstanceJSON(app, app.channel);
  }

  saveAppInstance(multisigAddress: string, app: AppInstanceJson): Promise<void> {
    throw new Error("Method not implemented.");
  }

  removeAppInstance(appInstanceId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
