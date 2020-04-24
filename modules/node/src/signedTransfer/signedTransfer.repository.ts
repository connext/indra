import { EntityRepository, Repository } from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { SimpleSignedTransferAppName, SimpleSignedTransferAppState } from "@connext/types";

@EntityRepository(AppInstance)
export class SignedTransferRepository extends Repository<
  AppInstance<SimpleSignedTransferAppState>
> {
  findSignedTransferAppsByPaymentId(
    paymentId: string,
  ): Promise<AppInstance<SimpleSignedTransferAppState>[]> {
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
  ): Promise<AppInstance<SimpleSignedTransferAppState> | undefined> {
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
  ): Promise<AppInstance<SimpleSignedTransferAppState> | undefined> {
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
