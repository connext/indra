import { providers } from "ethers";
import { EntityRepository, Repository, Between, getManager } from "typeorm";

import { Channel } from "../channel/channel.entity";

import {
  OnchainTransaction,
  TransactionReason,
  AnonymizedOnchainTransaction,
} from "./onchainTransaction.entity";

@EntityRepository(OnchainTransaction)
export class OnchainTransactionRepository extends Repository<OnchainTransaction> {
  async findByHash(txHash: string): Promise<OnchainTransaction | undefined> {
    return this.findOne({
      where: { hash: txHash },
      relations: ["channel"],
    });
  }

  async findByUserPublicIdentifier(
    userIdentifier: string,
  ): Promise<OnchainTransaction[] | undefined> {
    const txs = await this.createQueryBuilder("onchainTransaction")
      .leftJoinAndSelect("onchainTransaction.channel", "channel")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .orderBy("onchainTransaction.id", "ASC")
      .getMany();
    return txs;
  }

  async findLatestWithdrawalByUserPublicIdentifier(
    userIdentifier: string,
  ): Promise<OnchainTransaction | undefined> {
    const tx = await this.createQueryBuilder("onchainTransaction")
      .leftJoinAndSelect("onchainTransaction.channel", "channel")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .where("onchainTransaction.reason = :reason", { reason: TransactionReason.USER_WITHDRAWAL })
      .orderBy("onchainTransaction.id", "DESC")
      .getOne();
    return tx;
  }

  async addWithdrawal(tx: providers.TransactionResponse, channel: Channel): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      const { identifiers } = await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(OnchainTransaction)
        .values({
          ...tx,
          reason: TransactionReason.USER_WITHDRAWAL,
          channel,
        })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "transactions")
        .of(channel.multisigAddress)
        .add((identifiers[0] as OnchainTransaction).id);
    });
  }

  async addCollateralization(tx: providers.TransactionResponse, channel: Channel): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      const { identifiers } = await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(OnchainTransaction)
        .values({
          ...tx,
          reason: TransactionReason.COLLATERALIZATION,
          channel,
        })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "transactions")
        .of(channel.multisigAddress)
        .add((identifiers[0] as OnchainTransaction).id);
    });
  }

  async addReclaim(tx: providers.TransactionResponse, channel: Channel): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      const { identifiers } = await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(OnchainTransaction)
        .values({
          ...tx,
          reason: TransactionReason.NODE_WITHDRAWAL,
          channel,
        })
        .execute();

      await transactionalEntityManager
        .createQueryBuilder()
        .relation(Channel, "transactions")
        .of(channel.multisigAddress)
        .add((identifiers[0] as OnchainTransaction).id);
    });
  }
}

@EntityRepository(AnonymizedOnchainTransaction)
export class AnonymizedOnchainTransactionRepository extends Repository<
  AnonymizedOnchainTransaction
> {
  async findInTimeRange(start: number, end: number): Promise<AnonymizedOnchainTransaction[]> {
    return this.find({
      order: { createdAt: "DESC" },
      where: {
        createdAt: Between(new Date(start), new Date(end)),
      },
    });
  }
}
