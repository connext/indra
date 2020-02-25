import { AppInstanceJson, AppInstanceProposal } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { AppInstance } from "./appInstance.entity";
import { bigNumberify } from "ethers/utils";

export const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  return {
    appInterface: {
      ...app.abiEncodings,
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
    participants: [channel.userPublicIdentifier, channel.nodePublicIdentifier],
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
    initiatorDeposit: app.initiatorDeposit,
    initiatorDepositTokenAddress: app.initiatorDepositTokenAddress,
    outcomeType: app.outcomeType,
    proposedByIdentifier: app.proposedByIdentifier,
    proposedToIdentifier: app.proposedToIdentifier,
    responderDeposit: app.responderDeposit,
    responderDepositTokenAddress: app.responderDepositTokenAddress,
    timeout: app.timeout,
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
    });
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app) {
      return undefined;
    }

    return 
  }
}
