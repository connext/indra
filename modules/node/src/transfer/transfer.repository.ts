import { EntityRepository, Repository } from "typeorm";
import { GenericConditionalTransferAppName, ConditionalTransferAppNames } from "@connext/types";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";

@EntityRepository(AppInstance)
export class TransferRepository extends Repository<AppInstance> {
  findInstalledTransferAppsByPaymentId<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string): Promise<AppInstance<T>[]> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .getMany() as Promise<AppInstance<T>[]>;
  }

  findTransferAppByPaymentIdAndSender<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, senderSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T>>;
  }

  findTransferAppByPaymentIdAndReceiver<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, receiverSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T>>;
  }
}
