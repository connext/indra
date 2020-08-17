import { EntityRepository, Repository } from "typeorm";
import { GenericConditionalTransferAppName, ConditionalTransferAppNames } from "@connext/types";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";

@EntityRepository(AppInstance)
export class TransferRepository extends Repository<AppInstance> {
  findTransferAppByPaymentIdAndSender<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, senderSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T> | undefined>;
  }

  findTransferAppByPaymentIdAndReceiver<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(paymentId: string, receiverSignerAddress: string): Promise<AppInstance<T> | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where(`app_instance."meta"::JSONB @> '{ "paymentId": "${paymentId}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getOne() as Promise<AppInstance<T>>;
  }

  findTransferAppsByChannelUserIdentifierAndReceiver<
    T extends ConditionalTransferAppNames = typeof GenericConditionalTransferAppName
  >(userIdentifier: string, receiverSignerAddress: string): Promise<AppInstance<T>[] | []> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .andWhere(`app_instance."meta"::JSONB #> '{ "paymentId" }' IS NOT NULL`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .getMany() as Promise<AppInstance<T>[] | []>;
  }
}
