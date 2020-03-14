import { AppInstanceJson, AppInstanceProposal, OutcomeType } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { AppInstance, AppType } from "./appInstance.entity";
import { bigNumberify } from "ethers/utils";
import { Zero, AddressZero } from "ethers/constants";

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

  async saveAppProposal(channel: Channel, appProposal: AppInstanceProposal): Promise<void> {
    let app = await this.findByIdentityHash(appProposal.identityHash);
    if (!app) {
      app = new AppInstance();
    }
    app.type = AppType.PROPOSAL;
    app.identityHash = appProposal.identityHash;
    app.abiEncodings = appProposal.abiEncodings;
    app.appDefinition = appProposal.appDefinition;
    app.appSeqNo = appProposal.appSeqNo;
    app.initialState = appProposal.initialState;
    app.initiatorDeposit = bigNumberify(appProposal.initiatorDeposit);
    app.initiatorDepositTokenAddress = appProposal.initiatorDepositTokenAddress;
    app.latestState = appProposal.initialState;
    app.latestTimeout = bigNumberify(appProposal.timeout).toNumber();
    app.latestVersionNumber = 0;
    app.responderDeposit = bigNumberify(appProposal.responderDeposit);
    app.responderDepositTokenAddress = appProposal.responderDepositTokenAddress;
    app.timeout = bigNumberify(appProposal.timeout).toNumber();
    app.proposedToIdentifier = appProposal.proposedToIdentifier;
    app.proposedByIdentifier = appProposal.proposedByIdentifier;
    app.outcomeType = appProposal.outcomeType;

    app.channel = channel;

    await this.save(app);
  }

  async removeAppProposal(appInstanceId: string): Promise<AppInstance> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app) {
      throw new Error(`No app proposal existed for ${appInstanceId}`)
    }
    app.type = AppType.REJECTED;
    return this.save(app);
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

  async saveFreeBalance(channel: Channel, freeBalance: AppInstanceJson): Promise<void> {
    let freeBalanceSaved = await this.findByIdentityHash(freeBalance.identityHash);
    if (!freeBalanceSaved) {
      freeBalanceSaved = new AppInstance();
      freeBalanceSaved.identityHash = freeBalance.identityHash;
      freeBalanceSaved.type = AppType.FREE_BALANCE;
      freeBalanceSaved.abiEncodings = {
        stateEncoding: freeBalance.appInterface.stateEncoding,
        actionEncoding: freeBalance.appInterface.actionEncoding,
      };
      freeBalanceSaved.appDefinition = freeBalance.appInterface.addr;
      freeBalanceSaved.appSeqNo = freeBalance.appSeqNo;
      freeBalanceSaved.channel = channel;
      freeBalanceSaved.outcomeType = OutcomeType[freeBalance.outcomeType];
      // new instance, save initial state as latest
      freeBalanceSaved.initialState = freeBalance.latestState;
      freeBalanceSaved.participants = freeBalance.participants;
      // TODO: proper way to add these since free balance does not go thorugh
      // propose flow
      freeBalanceSaved.initiatorDeposit = Zero;
      freeBalanceSaved.initiatorDepositTokenAddress = AddressZero;
      freeBalanceSaved.responderDeposit = Zero;
      freeBalanceSaved.responderDepositTokenAddress = AddressZero;
      freeBalanceSaved.proposedToIdentifier = channel.userPublicIdentifier;
      freeBalanceSaved.proposedByIdentifier = channel.nodePublicIdentifier;
    }
    freeBalanceSaved.latestState = freeBalance.latestState;
    freeBalanceSaved.latestTimeout = freeBalance.latestTimeout;
    freeBalanceSaved.latestVersionNumber = freeBalance.latestVersionNumber;
    freeBalanceSaved.timeout = freeBalance.latestTimeout;

    // interpreter params
    freeBalanceSaved.multiAssetMultiPartyCoinTransferInterpreterParams =
      freeBalance.multiAssetMultiPartyCoinTransferInterpreterParams;

    freeBalanceSaved.singleAssetTwoPartyCoinTransferInterpreterParams =
      freeBalance.singleAssetTwoPartyCoinTransferInterpreterParams;

    freeBalanceSaved.twoPartyOutcomeInterpreterParams =
      freeBalance.twoPartyOutcomeInterpreterParams;

    freeBalanceSaved.channel = channel;
  }

  async getAppInstance(appInstanceId: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appInstanceId);
    if (!app) {
      return undefined;
    }
    return convertAppToInstanceJSON(app, app.channel);
  }

  async saveAppInstance(channel: Channel, appJson: AppInstanceJson): Promise<AppInstance> {
    const {
      identityHash,
      latestState,
      latestTimeout,
      latestVersionNumber,
      multiAssetMultiPartyCoinTransferInterpreterParams,
      participants,
      singleAssetTwoPartyCoinTransferInterpreterParams,
      twoPartyOutcomeInterpreterParams,
    } = appJson;
    let app = await this.findByIdentityHash(identityHash);
    if (!app) {
      throw new Error(`Did not find app with identity hash: ${identityHash}`);
    }
    if (app.type === AppType.INSTANCE && app.latestVersionNumber === latestVersionNumber) {
      // app was not updated, return
      return app;
    }
    // first time app is being upgraded from proposal to instance
    if (app.type === AppType.PROPOSAL) {
      app.type = AppType.INSTANCE;
      app.participants = participants;
      app.singleAssetTwoPartyCoinTransferInterpreterParams = singleAssetTwoPartyCoinTransferInterpreterParams;
      app.twoPartyOutcomeInterpreterParams = twoPartyOutcomeInterpreterParams;
      app.multiAssetMultiPartyCoinTransferInterpreterParams = multiAssetMultiPartyCoinTransferInterpreterParams;
    }
    app.latestState = latestState;
    app.latestTimeout = latestTimeout;
    app.latestVersionNumber = latestVersionNumber;

    // TODO: everything else should already be in from the proposal, verify this
    app.channel = channel;
    return this.save(app);
  }

  removeAppInstance(app: AppInstance): Promise<AppInstance> {
    app.type = AppType.UNINSTALLED;
    return this.save(app);
  }
}
