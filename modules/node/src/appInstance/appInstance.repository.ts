import { AppInstanceJson, AppInstanceProposal } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { AppInstance } from "./appInstance.entity";
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

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app) {
      return undefined;
    }
    return convertAppToInstanceJSON(app, app.channel);
  }
}
