import { HashLockTransferAppName, Address, Bytes32 } from "@connext/types";
import { constants } from "ethers";
import { EntityRepository, Repository } from "typeorm";

import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { AppRegistry } from "../appRegistry/appRegistry.entity";

const { HashZero } = constants;

@EntityRepository(AppInstance)
export class HashlockTransferRepository extends Repository<
  AppInstance<typeof HashLockTransferAppName>
> {
  findHashLockTransferAppsByLockHashAndAssetId(
    lockHash: Bytes32,
    assetId: Address,
  ): Promise<AppInstance[]> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: HashLockTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
      .getMany();
  }

  findRedeemedHashLockTransferAppByLockHashAndAssetIdFromNode(
    lockHash: Bytes32,
    nodeSignerAddress: Address,
    assetId: Address,
  ): Promise<AppInstance> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect(
          AppRegistry,
          "app_registry",
          "app_registry.appDefinitionAddress = app_instance.appDefinition",
        )
        .leftJoinAndSelect("app_instance.channel", "channel")
        .where("app_registry.name = :name", { name: HashLockTransferAppName })
        // if uninstalled, redeemed
        .andWhere("app_instance.type = :type", { type: AppType.UNINSTALLED })
        .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
        // node is sender
        .andWhere(
          `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${nodeSignerAddress}"'`,
        )
        .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
        .getOne()
    );
  }

  findHashLockTransferAppByLockHashAssetIdAndRecipient(
    lockHash: Bytes32,
    recipientIdentifier: string,
    assetId: Address,
  ): Promise<AppInstance | undefined> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect(
          AppRegistry,
          "app_registry",
          "app_registry.appDefinitionAddress = app_instance.appDefinition",
        )
        .leftJoinAndSelect("app_instance.channel", "channel")
        .where("app_registry.name = :name", { name: HashLockTransferAppName })
        // meta for transfer recipient
        .andWhere(`app_instance."meta"::JSONB @> '{"recipient":"${recipientIdentifier}"}'`)
        .andWhere(`app_instance."latestState"::JSONB @> '{"lockHash": "${lockHash}"}'`)
        .andWhere(`app_instance."interpreterParams"::JSONB @> '{ "tokenAddress": "${assetId}" }'`)
        .getOne()
    );
  }

  findHashLockTransferAppByLockHashAssetIdAndSender(
    lockHash: Bytes32,
    senderSignerAddress: Address,
    assetId: Address,
  ): Promise<AppInstance | undefined> {
    return this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: HashLockTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",0,"to"}' = '"${senderSignerAddress}"'`,
      )
      .andWhere(`app_instance."initiatorDepositAssetId" = :assetId`, { assetId })
      .getOne();
  }

  findHashLockTransferAppsByLockHashAssetIdAndReceiver(
    lockHash: Bytes32,
    receiverSignerAddress: Address,
    assetId: Address,
  ): Promise<AppInstance | undefined> {
    const query = this.createQueryBuilder("app_instance")
      .leftJoinAndSelect(
        AppRegistry,
        "app_registry",
        "app_registry.appDefinitionAddress = app_instance.appDefinition",
      )
      .leftJoinAndSelect("app_instance.channel", "channel")
      .where("app_registry.name = :name", { name: HashLockTransferAppName })
      .andWhere(`app_instance."latestState"::JSONB @> '{ "lockHash": "${lockHash}" }'`)
      .andWhere(
        `app_instance."latestState"::JSONB #> '{"coinTransfers",1,"to"}' = '"${receiverSignerAddress}"'`,
      )
      .andWhere(`app_instance."initiatorDepositAssetId" = :assetId`, { assetId });
    return query.getOne();
  }

  findActiveHashLockTransferAppsToRecipient(
    recipientIdentifier: string,
    nodeSignerAddress: Address,
    currentBlock: number,
  ): Promise<AppInstance[]> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect(
          AppRegistry,
          "app_registry",
          "app_registry.appDefinitionAddress = app_instance.appDefinition",
        )
        .leftJoinAndSelect("app_instance.channel", "channel")
        .where("app_registry.name = :name", { name: HashLockTransferAppName })
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
        .getMany()
    );
  }

  findActiveHashLockTransferAppsFromSenderToNode(
    senderSignerAddress: Address,
    nodeSignerAddress: Address,
    currentBlock: number,
  ): Promise<AppInstance[]> {
    return (
      this.createQueryBuilder("app_instance")
        .leftJoinAndSelect(
          AppRegistry,
          "app_registry",
          "app_registry.appDefinitionAddress = app_instance.appDefinition",
        )
        .leftJoinAndSelect("app_instance.channel", "channel")
        .where("app_registry.name = :name", { name: HashLockTransferAppName })
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
        // preimage can be HashZero or empty, if its HashZero, then the
        // node should takeAction + uninstall. if its not HashZero, then
        // the node should just uninstall. If the node has completed the
        // transfer, then the type would be AppType.UNINSTALLED
        .getMany()
    );
  }
}
