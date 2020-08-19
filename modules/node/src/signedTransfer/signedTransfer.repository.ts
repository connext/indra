import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { SimpleSignedTransferAppName } from "@connext/types";

@EntityRepository(AppInstance)
export class SignedTransferRepository extends Repository<
  AppInstance<typeof SimpleSignedTransferAppName>
> {
  findInstalledSignedTransferAppsByPaymentId(
    paymentId: string,
    appDefinition: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getOne();
  }

  findSignedTransferAppsByPaymentId(
    paymentId: string,
    appDefinition: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName>[]> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getMany();
  }

  findSignedTransferAppByPaymentIdAndSender(
    paymentId: string,
    senderSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getOne();
  }

  findSignedTransferAppByPaymentIdAndReceiver(
    paymentId: string,
    receiverSignerAddress: string,
    appDefinition: string,
  ): Promise<AppInstance<typeof SimpleSignedTransferAppName> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getOne();
  }
}
