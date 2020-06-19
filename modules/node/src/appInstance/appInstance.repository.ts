import {
  AppInstanceJson,
  AppState,
  SimpleLinkedTransferAppName,
  JSONSerializer,
} from "@connext/types";
import { constants } from "ethers";
import { getSignerAddressFromPublicIdentifier, safeJsonParse } from "@connext/utils";
import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "./appInstance.entity";

const { HashZero } = constants;

export const AppInstanceSerializer: JSONSerializer<AppInstance, AppInstanceJson> = class {
  static toJSON(app: AppInstance): AppInstanceJson {
    if (!app) {
      return undefined;
    }
    const json: AppInstanceJson = {
      appDefinition: app.appDefinition,
      abiEncodings: {
        stateEncoding: app.stateEncoding,
        actionEncoding: app.actionEncoding || null,
      },
      appSeqNo: app.appSeqNo,
      defaultTimeout: app.defaultTimeout,
      identityHash: app.identityHash,
      latestState: app.latestState,
      stateTimeout: app.stateTimeout,
      latestVersionNumber: app.latestVersionNumber,
      multisigAddress: app.channel.multisigAddress,
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
  }
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

  findByIdentityHashAndType(identityHash: string, type: AppType): Promise<AppInstance | undefined> {
    return this.findOne({
      where: { identityHash, type: AppType.PROPOSAL },
      relations: ["channel"],
    });
  }

  async getAppProposal(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHashAndType(appIdentityHash, AppType.PROPOSAL);
    return AppInstanceSerializer.toJSON(app);
  }

  async getFreeBalance(multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const [app] = await this.findByMultisigAddressAndType(multisigAddress, AppType.FREE_BALANCE);
    return app && AppInstanceSerializer.toJSON(app);
  }

  async getAppInstance(appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHashAndType(appIdentityHash, AppType.INSTANCE);
    return AppInstanceSerializer.toJSON(app);
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

  async findTransferAppsByAppDefinitionPaymentIdAndType(
    paymentId: string,
    appDefinition: string,
    type: AppType = AppType.INSTANCE,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.type = :type", { type })
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getMany();
    return res;
  }

  async findTransferAppByAppDefinitionPaymentIdAndSender(
    paymentId: string,
    senderIdentifier: string,
    appDefinition: string,
  ): Promise<AppInstance> {
    const senderAddress = getSignerAddressFromPublicIdentifier(senderIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderAddress}"'`,
      )
      .getOne();
  }

  async findTransferAppByAppDefinitionPaymentIdAndReceiver(
    paymentId: string,
    receiverIdentifier: string,
    appDefinition: string,
  ): Promise<AppInstance> {
    const receiverAddress = getSignerAddressFromPublicIdentifier(receiverIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      // receiver is recipient
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverAddress}"'`,
      )
      .getOne();
  }

  async findRedeemedTransferAppByAppDefinitionPaymentIdFromNode(
    paymentId: string,
    nodeSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      // if uninstalled, redeemed
      .andWhere("app_instance.type = :type", { type: AppType.UNINSTALLED })
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      // node is sender
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${nodeSignerAddress}"'`,
      )
      .getOne();
    return res;
  }

  async findActiveTransferAppsByAppDefinitionToRecipient(
    recipientIdentifier: string,
    nodeSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      // node is receiver of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${nodeSignerAddress}"'`,
      )
      // meta for transfer recipient
      .andWhere(`app_instance."meta"::JSONB @> '{"recipient":"${recipientIdentifier}"}'`)
      // preImage is HashZero
      .andWhere(`app_instance."latestState"::JSONB @> '{"preImage": "${HashZero}"}'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getMany();
    return res;
  }

  async findActiveTransferAppsByAppDefinitionFromSenderToNode(
    senderSignerAddress: string,
    nodeSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      // sender is sender of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      // node is receiver of transfer
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${nodeSignerAddress}"'`,
      )
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      // preimage can be HashZero or empty, if its HashZero, then the
      // node should takeAction + uninstall. if its not HashZero, then
      // the node should just uninstall. If the node has completed the
      // transfer, then the type would be AppType.UNINSTALLED
      .getMany();
    return res;
  }

  async findTransferAppsByAppDefinitionAndPaymentId(
    paymentId: string,
    appDefinition: string,
  ): Promise<AppInstance[]> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
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
