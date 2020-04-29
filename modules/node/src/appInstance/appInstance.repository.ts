import {
  AppInstanceJson,
  AppInstanceProposal,
  OutcomeType,
  SimpleLinkedTransferAppName,
} from "@connext/types";
import { safeJsonParse } from "@connext/utils";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";

import { AppInstance, AppType } from "./appInstance.entity";
import { constants } from "ethers";

export const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  if (!app) {
    return undefined;
  }
  // interpreter params
  let multiAssetMultiPartyCoinTransferInterpreterParams = null;
  let singleAssetTwoPartyCoinTransferInterpreterParams = null;
  let twoPartyOutcomeInterpreterParams = null;

  switch (OutcomeType[app.outcomeType]) {
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
      twoPartyOutcomeInterpreterParams = safeJsonParse(app.outcomeInterpreterParameters);
      break;

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
      multiAssetMultiPartyCoinTransferInterpreterParams = safeJsonParse(
        app.outcomeInterpreterParameters,
      );
      break;

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
      singleAssetTwoPartyCoinTransferInterpreterParams = safeJsonParse(
        app.outcomeInterpreterParameters,
      );
      break;

    default:
      throw new Error(`Unrecognized outcome type: ${OutcomeType[app.outcomeType]}`);
  }
  const json: AppInstanceJson = {
    appInterface: {
      stateEncoding: app.stateEncoding,
      actionEncoding: app.actionEncoding || null,
      addr: app.appDefinition,
    },
    appSeqNo: app.appSeqNo,
    defaultTimeout: app.defaultTimeout,
    identityHash: app.identityHash,
    latestState: app.latestState,
    stateTimeout: app.stateTimeout,
    latestVersionNumber: app.latestVersionNumber,
    multisigAddress: channel.multisigAddress,
    outcomeType: app.outcomeType,
    // TODO: should we add initatior/responder to the app instance table?
    initiatorIdentifier: app.initiatorIdentifier,
    responderIdentifier: app.responderIdentifier,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
  };
  return json;
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
      twoPartyOutcomeInterpreterParams = safeJsonParse(app.outcomeInterpreterParameters);
      break;

    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
      multiAssetMultiPartyCoinTransferInterpreterParams = safeJsonParse(
        app.outcomeInterpreterParameters,
      );
      break;

    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
      singleAssetTwoPartyCoinTransferInterpreterParams = safeJsonParse(
        app.outcomeInterpreterParameters,
      );
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
    initiatorDepositAssetId: app.initiatorDepositAssetId,
    outcomeType: app.outcomeType,
    initiatorIdentifier: app.initiatorIdentifier,
    responderIdentifier: app.responderIdentifier,
    responderDeposit: app.responderDeposit.toHexString(),
    responderDepositAssetId: app.responderDepositAssetId,
    defaultTimeout: app.defaultTimeout,
    stateTimeout: app.stateTimeout,
    multiAssetMultiPartyCoinTransferInterpreterParams,
    singleAssetTwoPartyCoinTransferInterpreterParams,
    twoPartyOutcomeInterpreterParams,
  };
};

@EntityRepository(AppInstance)
export class AppInstanceRepository extends Repository<AppInstance> {
  findByIdentityHash(identityHash: string): Promise<AppInstance | undefined> {
    return this.findOne({
      where: { identityHash },
      relations: ["channel"],
    });
  }

  async findByIdentityHashOrThrow(identityHash: string): Promise<AppInstance> {
    const app = await this.findByIdentityHash(identityHash);
    if (!app) {
      throw new Error(`Could not find app with identity hash ${identityHash}`);
    }
    return app;
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
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceProposal | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    if (!app || app.type !== AppType.PROPOSAL) {
      return undefined;
    }
    return convertAppToProposedInstanceJSON(app);
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const [app] = await this.findByMultisigAddressAndType(multisigAddress, AppType.FREE_BALANCE);
    return app && convertAppToInstanceJSON(app, app.channel);
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    return app && convertAppToInstanceJSON(app, app.channel);
  }

  async findInstalledAppsByAppDefinition(
    multisigAddress: string,
    appDefinition: string,
  ): Promise<AppInstance[]> {
    return this.createQueryBuilder("app_instances")
      .leftJoinAndSelect("app_instances.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .where("app_instances.type = :type", { type: AppType.INSTANCE })
      .andWhere("app_instances.appDefinition = :appDefinition", { appDefinition })
      .getMany();
  }

  async findLinkedTransferAppsByPaymentIdAndType(
    paymentId: string,
    type: AppType = AppType.INSTANCE,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.type = :type", { type })
      .getMany();
    return res;
  }

  async findLinkedTransferAppByPaymentIdAndSender(
    paymentId: string,
    senderSignerAddress: string,
  ): Promise<AppInstance> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .getOne();
    return res;
  }

  async findLinkedTransferAppByPaymentIdAndReceiver(
    paymentId: string,
    receiverSignerAddress: string,
  ): Promise<AppInstance> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      // receiver is recipient
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getOne();
    return res;
  }

  async findRedeemedLinkedTransferAppByPaymentIdFromNode(
    paymentId: string,
    nodeSignerAddress: string,
  ): Promise<AppInstance> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      // if uninstalled, redeemed
      .andWhere("app_instance.type = :type", { type: AppType.UNINSTALLED })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      // node is sender
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${nodeSignerAddress}"'`,
      )
      .getOne();
    return res;
  }

  async findActiveLinkedTransferAppsToRecipient(
    recipientIdentifier: string,
    nodeSignerAddress: string,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      // node is receiver of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${nodeSignerAddress}"'`,
      )
      // meta for transfer recipient
      .andWhere(`app_instance."meta"::JSONB @> '{"recipient":"${recipientIdentifier}"}'`)
      // preImage is constants.HashZero
      .andWhere(`app_instance."latestState"::JSONB @> '{"preImage": "${constants.HashZero}"}'`)
      .getMany();
    return res;
  }

  async findActiveLinkedTransferAppsFromSenderToNode(
    senderSignerAddress: string,
    nodeSignerAddress: string,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      // sender is sender of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      // node is receiver of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${nodeSignerAddress}"'`,
      )
      // preimage can be constants.HashZero or empty, if its constants.HashZero, then the
      // node should takeAction + uninstall. if its not constants.HashZero, then
      // the node should just uninstall. If the node has completed the
      // transfer, then the type would be AppType.UNINSTALLED
      .getMany();
    return res;
  }

  async findLinkedTransferAppsByPaymentId(paymentId: string): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getMany();
    return res;
  }
}
