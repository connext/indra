import { EntityRepository, Repository } from "typeorm";

import { AppInstance } from "../appInstance/appInstance.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { SimpleSignedTransferApp } from "@connext/types";

@EntityRepository(AppInstance)
export class SignedTransferRepository extends Repository<AppInstance> {
  findSignedTransferAppsByPaymentId(paymentId: string): Promise<AppInstance[]> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferApp })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getMany();
  }

  findSignedTransferAppByPaymentIdAndSender(
    paymentId: string,
    sender: string,
  ): Promise<AppInstance | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferApp })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(`app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${sender}"'`)
      .getOne();
  }

  findSignedTransferAppByPaymentIdAndReceiver(
    paymentId: string,
    receiver: string,
  ): Promise<AppInstance | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: SimpleSignedTransferApp })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(`app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiver}"'`)
      .getOne();
  }
}
