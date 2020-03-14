import { AppInstanceJson, AppInstanceProposal, OutcomeType } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";

import { AppInstance, AppType } from "./appInstance.entity";
import { bigNumberify } from "ethers/utils";
import { Zero, AddressZero } from "ethers/constants";
import { xkeysToSortedKthAddresses, sortAddresses } from "../util";

export const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  if (!app) {
    return undefined;
  }
  // interpreter params
  let multiAssetMultiPartyCoinTransferInterpreterParams = undefined;
  let singleAssetTwoPartyCoinTransferInterpreterParams = undefined;
  let twoPartyOutcomeInterpreterParams = undefined;

  switch (OutcomeType[app.outcomeType]) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
      twoPartyOutcomeInterpreterParams = app.outcomeInterpreterParameters;
      break;

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
      multiAssetMultiPartyCoinTransferInterpreterParams = app.outcomeInterpreterParameters;
      break;

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
      singleAssetTwoPartyCoinTransferInterpreterParams = app.outcomeInterpreterParameters;
      break;

    default:
      throw new Error(`Unrecognized outcome type: ${OutcomeType[app.outcomeType]}`);
  }
  return {
    appInterface: {
      stateEncoding: app.stateEncoding,
      actionEncoding: app.actionEncoding || undefined,
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
    participants: sortAddresses([app.userParticipantAddress, app.nodeParticipantAddress]),
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
  };
};

export const convertAppToProposedInstanceJSON = (app: AppInstance): AppInstanceProposal => {
  if (!app) {
    return undefined;
  }
  // interpreter params
  let multiAssetMultiPartyCoinTransferInterpreterParams = undefined;
  let singleAssetTwoPartyCoinTransferInterpreterParams = undefined;
  let twoPartyOutcomeInterpreterParams = undefined;

  switch (OutcomeType[app.outcomeType]) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
      twoPartyOutcomeInterpreterParams = app.outcomeInterpreterParameters;
      break;

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
      multiAssetMultiPartyCoinTransferInterpreterParams = app.outcomeInterpreterParameters;
      break;

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
      singleAssetTwoPartyCoinTransferInterpreterParams = app.outcomeInterpreterParameters;
      break;

    default:
      throw new Error(`Unrecognized outcome type: ${OutcomeType[app.outcomeType]}`);
  }
  return {
    abiEncodings: {
      stateEncoding: app.stateEncoding,
      actionEncoding: app.actionEncoding,
    },
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
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
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
    app.actionEncoding = appProposal.abiEncodings.actionEncoding;
    app.stateEncoding = appProposal.abiEncodings.stateEncoding;
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
    if (!app || app.type !== AppType.PROPOSAL) {
      throw new Error(`No app proposal existed for ${appInstanceId}`);
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

  async saveFreeBalance(channel: Channel, freeBalance: AppInstanceJson): Promise<AppInstance> {
    let freeBalanceSaved = await this.findByIdentityHash(freeBalance.identityHash);
    if (!freeBalanceSaved) {
      freeBalanceSaved = new AppInstance();
      freeBalanceSaved.identityHash = freeBalance.identityHash;
      freeBalanceSaved.type = AppType.FREE_BALANCE;
      freeBalanceSaved.stateEncoding = freeBalance.appInterface.stateEncoding;
      freeBalanceSaved.actionEncoding = freeBalance.appInterface.actionEncoding;
      freeBalanceSaved.appDefinition = freeBalance.appInterface.addr;
      freeBalanceSaved.appSeqNo = freeBalance.appSeqNo;
      freeBalanceSaved.channel = channel;
      freeBalanceSaved.outcomeType = OutcomeType[freeBalance.outcomeType];
      // new instance, save initial state as latest
      freeBalanceSaved.initialState = freeBalance.latestState;
      // save participants
      const userFreeBalance = xkeysToSortedKthAddresses([channel.userPublicIdentifier])[0];
      freeBalanceSaved.userParticipantAddress = freeBalance.participants.filter(
        p => p === userFreeBalance,
      )[0];
      freeBalanceSaved.nodeParticipantAddress = freeBalance.participants.filter(
        p => p !== userFreeBalance,
      )[0];
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
    switch (OutcomeType[freeBalance.outcomeType]) {
      case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
        freeBalanceSaved.outcomeInterpreterParameters =
          freeBalance.twoPartyOutcomeInterpreterParams;
        break;

      case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
        freeBalanceSaved.outcomeInterpreterParameters =
          freeBalance.multiAssetMultiPartyCoinTransferInterpreterParams;
        break;

      case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
        freeBalanceSaved.outcomeInterpreterParameters =
          freeBalance.singleAssetTwoPartyCoinTransferInterpreterParams;
        break;

      default:
        throw new Error(`Unrecognized outcome type: ${OutcomeType[freeBalance.outcomeType]}`);
    }
    return this.save(freeBalanceSaved);
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
    if (app.type !== AppType.INSTANCE) {
      app.type = AppType.INSTANCE;
      // save participants
      const userAddr = xkeysToSortedKthAddresses([channel.userPublicIdentifier], app.appSeqNo)[0];
      app.userParticipantAddress = participants.filter(p => p === userAddr)[0];
      app.nodeParticipantAddress = participants.filter(p => p !== userAddr)[0];
    }
    app.latestState = latestState;
    app.latestTimeout = latestTimeout;
    app.latestVersionNumber = latestVersionNumber;

    // interpreter params
    switch (OutcomeType[app.outcomeType]) {
      case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
        app.outcomeInterpreterParameters = twoPartyOutcomeInterpreterParams;
        break;

      case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
        app.outcomeInterpreterParameters = multiAssetMultiPartyCoinTransferInterpreterParams;
        break;

      case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
        app.outcomeInterpreterParameters = singleAssetTwoPartyCoinTransferInterpreterParams;
        break;

      default:
        throw new Error(`Unrecognized outcome type: ${OutcomeType[app.outcomeType]}`);
    }

    // TODO: everything else should already be in from the proposal, verify this
    return this.save(app);
  }

  removeAppInstance(app: AppInstance): Promise<AppInstance> {
    if (app.type !== AppType.INSTANCE) {
      throw new Error(`App is not of correct type`)
    }
    app.type = AppType.UNINSTALLED;
    return this.save(app);
  }
}
