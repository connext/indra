import { AppInstanceJson, AppState, SimpleLinkedTransferAppName } from "@connext/types";
import { constants } from "ethers";
import { getSignerAddressFromPublicIdentifier, safeJsonParse } from "@connext/utils";
import { EntityRepository, Repository } from "typeorm";

import { Channel } from "../channel/channel.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";

import { AppInstance, AppType } from "./appInstance.entity";

const { HashZero } = constants;

export const convertAppToInstanceJSON = (app: AppInstance, channel: Channel): AppInstanceJson => {
  if (!app) {
    return undefined;
  }
  const json: AppInstanceJson = {
    appDefinition: app.appDefinition,
    abiEncodings: { stateEncoding: app.stateEncoding, actionEncoding: app.actionEncoding || null },
    appSeqNo: app.appSeqNo,
    defaultTimeout: app.defaultTimeout,
    identityHash: app.identityHash,
    latestState: app.latestState,
    stateTimeout: app.stateTimeout,
    latestVersionNumber: app.latestVersionNumber,
    multisigAddress: channel.multisigAddress,
    outcomeType: app.outcomeType,
    initiatorIdentifier: app.initiatorIdentifier,
    responderIdentifier: app.responderIdentifier,
    outcomeInterpreterParameters: safeJsonParse(app.outcomeInterpreterParameters),
    meta: app.meta,
    initiatorDeposit: app.initiatorDeposit.toString(),
    initiatorDepositAssetId: app.initiatorDepositAssetId,
    responderDeposit: app.responderDeposit.toString(),
    responderDepositAssetId: app.responderDepositAssetId,
  };
  return json;
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

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    if (!app || app.type !== AppType.PROPOSAL) {
      return undefined;
    }
    return convertAppToInstanceJSON(app, app.channel);
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const [app] = await this.findByMultisigAddressAndType(multisigAddress, AppType.FREE_BALANCE);
    return app && convertAppToInstanceJSON(app, app.channel);
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    if (!app || app.type !== AppType.INSTANCE) {
      return undefined;
    }
    return convertAppToInstanceJSON(app, app.channel);
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
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.type = :type", { type })
      .getMany();
    return res;
  }

  async findLinkedTransferAppByPaymentIdAndSender(
    paymentId: string,
    senderIdentifier: string,
  ): Promise<AppInstance> {
    const senderAddress = getSignerAddressFromPublicIdentifier(senderIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderAddress}"'`,
      )
      .getOne();
  }

  async findLinkedTransferAppByPaymentIdAndReceiver(
    paymentId: string,
    receiverIdentifier: string,
  ): Promise<AppInstance> {
    const receiverAddress = getSignerAddressFromPublicIdentifier(receiverIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleLinkedTransferAppName })
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      // receiver is recipient
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverAddress}"'`,
      )
      .getOne();
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
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
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
      // preImage is HashZero
      .andWhere(`app_instance."latestState"::JSONB @> '{"preImage": "${HashZero}"}'`)
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
      // preimage can be HashZero or empty, if its HashZero, then the
      // node should takeAction + uninstall. if its not HashZero, then
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
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getMany();
    return res;
  }

  async updateAppStateOnUninstall(uninstalledApp: AppInstanceJson): Promise<void> {
    await this.createQueryBuilder("app_instance")
      .update(AppInstance)
      .set({
        latestState: uninstalledApp.latestState as AppState,
        stateTimeout: uninstalledApp.stateTimeout,
        latestVersionNumber: uninstalledApp.latestVersionNumber,
      })
      .where("identityHash = :identityHash", { identityHash: uninstalledApp.identityHash })
      .execute();
  }
}
