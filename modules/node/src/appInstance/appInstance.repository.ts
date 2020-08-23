import {
  AppInstanceJson,
  JSONSerializer,
  GenericConditionalTransferAppName,
  ConditionalTransferAppNames,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, safeJsonParse } from "@connext/utils";
import { constants } from "ethers";
import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "./appInstance.entity";

const { HashZero } = constants;

export const AppInstanceSerializer: JSONSerializer<AppInstance, AppInstanceJson> = class {
  static toJSON(app: AppInstance): AppInstanceJson | undefined {
    if (!app) {
      return undefined;
    }
    const json: AppInstanceJson = {
      appDefinition: app.appDefinition,
      abiEncodings: {
        stateEncoding: app.stateEncoding,
        actionEncoding: app.actionEncoding,
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
      initiatorDeposit: (app.initiatorDeposit || 0).toString(),
      initiatorDepositAssetId: app.initiatorDepositAssetId,
      responderDeposit: (app.responderDeposit || 0).toString(),
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
      where: { identityHash, type },
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
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.type = :type", { type })
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getMany();
    return res;
  }

  findTransferAppByPaymentIdAndSender<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, senderSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .where(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T> | undefined>;
  }

  async findTransferAppByAppDefinitionPaymentIdAndSender(
    paymentId: string,
    senderIdentifier: string,
    appDefinition: string,
  ): Promise<AppInstance | undefined> {
    const senderAddress = getSignerAddressFromPublicIdentifier(senderIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
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
  ): Promise<AppInstance | undefined> {
    const receiverAddress = getSignerAddressFromPublicIdentifier(receiverIdentifier);
    return await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      // receiver is recipient
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverAddress}"'`,
      )
      .getOne();
  }

  findTransferAppsByChannelUserIdentifierAndReceiver<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(userIdentifier: string, receiverSignerAddress: string): Promise<AppInstance<T>[] | []> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .andWhere(`app_instance."meta"::JSONB #> '{ "paymentId" }' IS NOT NULL`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getMany() as Promise<AppInstance<T>[] | []>;
  }

  findTransferAppByPaymentIdAndReceiver<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, receiverSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .where(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T>>;
  }

  async findRedeemedTransferAppByAppDefinitionPaymentIdFromNode(
    paymentId: string,
    nodeSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance | undefined> {
    const res = await this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .leftJoinAndSelect("app_instance.transfer", "transfer")
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
      .leftJoinAndSelect("app_instance.transfer", "transfer")
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
      .leftJoinAndSelect("app_instance.transfer", "transfer")
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
      .leftJoinAndSelect("app_instance.transfer", "transfer")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getMany();
    return res;
  }
}
