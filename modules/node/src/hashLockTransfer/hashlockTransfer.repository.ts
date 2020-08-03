import { HashLockTransferAppName, Address, Bytes32 } from "@connext/types";
import { constants } from "ethers";
import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";

const { HashZero } = constants;

@EntityRepository(AppInstance)
export class HashlockTransferRepository extends Repository<
  AppInstance<typeof HashLockTransferAppName>
> {
  findHashLockTransferAppsByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
    appDefinition: Address,
  ): Promise<AppInstance[]> {
    return this.createQueryBuilder("app_instance")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
      .getMany();
  }

  findRedeemedHashLockTransferAppByLockHashAndAssetIdFromNode(
    lockHash: Bytes32,
    nodeSignerAddress: Address,
    assetId: Address,
    appDefinition: Address,
  ): Promise<AppInstance> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect("app_instance.channel", "channel")
        // if uninstalled, redeemed
        .andWhere("app_instance.type = :type", { type: AppType.UNINSTALLED })
        .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
        // node is sender
        .andWhere(
          `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${nodeSignerAddress}"'`,
        )
        .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
        .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
        .getOne()
    );
  }

  findHashLockTransferAppByLockHashAssetIdAndRecipient(
    lockHash: Bytes32,
    recipientIdentifier: string,
    assetId: Address,
    appDefinition: Address,
  ): Promise<AppInstance | undefined> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect("app_instance.channel", "channel")
        // meta for transfer recipient
        .andWhere(`app_instance."meta"::JSONB @> '{"recipient":"${recipientIdentifier}"}'`)
        .andWhere(`app_instance."latestState"::JSONB @> '{"lockHash": "${lockHash}"}'`)
        .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
        .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
        .getOne()
    );
  }

  findHashLockTransferAppByLockHashAssetIdAndSender(
    lockHash: Bytes32,
    senderSignerAddress: Address,
    assetId: Address,
    appDefinition: Address,
  ): Promise<AppInstance | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .andWhere(`app_instance."initiatorDepositAssetId" = :assetId`, { assetId })
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
      .getOne();
  }

  findHashLockTransferAppsByLockHashAssetIdAndReceiver(
    lockHash: Bytes32,
    receiverSignerAddress: Address,
    assetId: Address,
    appDefinition: Address,
  ): Promise<AppInstance | undefined> {
    const query = this.createQueryBuilder("app_instance")
      .leftJoinAndSelect("app_instance.channel", "channel")
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .andWhere(`app_instance."initiatorDepositAssetId" = :assetId`, { assetId })
      .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition });
    return query.getOne();
  }

  findActiveHashLockTransferAppsToRecipient(
    recipientIdentifier: string,
    nodeSignerAddress: Address,
    currentBlock: number,
    appDefinition: Address,
  ): Promise<AppInstance[]> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect("app_instance.channel", "channel")
        .andWhere("app_instance.type = :type", { type: AppType.INSTANCE })
        // node is receiver of transfer
        .andWhere(
          `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${nodeSignerAddress}"'`,
        )
        // meta for transfer recipient
        .andWhere(`app_instance."meta"::JSONB @> '{"recipient":"${recipientIdentifier}"}'`)
        // preimage can be HashZero or empty, if its HashZero, then the
        // node should takeAction + uninstall. if its not HashZero, then
        // the node should just uninstall. If the node has completed the
        // transfer, then the type would be AppType.UNINSTALLED
        .andWhere(`app_instance."latestState"::JSONB @> '{"lockHash": "${HashZero}"}'`)
        // and timeout hasnt passed
        .andWhere(`app_instance."latestState"->>"timeout"::NUMERIC > ${currentBlock}`)
        .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
        .getMany()
    );
  }

  findActiveHashLockTransferAppsFromSenderToNode(
    senderSignerAddress: Address,
    nodeSignerAddress: Address,
    currentBlock: number,
    appDefinition: Address,
  ): Promise<AppInstance[]> {
    return (
      this.createQueryBuilder("app_instance")
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
        // and timeout hasnt passed
        .andWhere(`app_instance."latestState"->>"timeout"::NUMERIC > ${currentBlock}`)
        .andWhere("app_instance.appDefinition = :appDefinition", { appDefinition })
        // preimage can be HashZero or empty, if its HashZero, then the
        // node should takeAction + uninstall. if its not HashZero, then
        // the node should just uninstall. If the node has completed the
        // transfer, then the type would be AppType.UNINSTALLED
        .getMany()
    );
  }
}
