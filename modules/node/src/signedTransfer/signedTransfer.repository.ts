import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { SimpleSignedTransferAppName } from "@connext/types";

@EntityRepository(AppInstance)
export class SignedTransferRepository extends Repository<
  AppInstance<typeof SimpleSignedTransferAppName>
> {
  findInstalledSignedTransferAppsByPaymentId(
    paymentId: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName>> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferAppName })
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getOne();
  }

  findSignedTransferAppsByPaymentId(
    paymentId: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName>[]> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getMany();
  }

  findSignedTransferAppByPaymentIdAndSender(
    paymentId: string,
    senderSignerAddress: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .getOne();
  }

  findSignedTransferAppByPaymentIdAndReceiver(
    paymentId: string,
    receiverSignerAddress: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getOne();
  }
}
