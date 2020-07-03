import { providers, constants } from "ethers";
import { EntityRepository, Repository, Between, getManager } from "typeorm";

import { Channel } from "../channel/channel.entity";

import {
  OnchainTransaction,
  TransactionReason,
  AnonymizedOnchainTransaction,
  TransactionStatus,
} from "./onchainTransaction.entity";
const { Zero } = constants;

export const onchainEntityToReceipt = (
  entity: OnchainTransaction | undefined,
): providers.TransactionReceipt | undefined => {
  if (!entity) {
    return undefined;
  }
  const { to, from, gasUsed, logsBloom, blockHash, hash: transactionHash, blockNumber } = entity;
  return {
    to,
    from,
    gasUsed,
    logsBloom,
    blockHash,
    transactionHash,
    blockNumber,
  } as providers.TransactionReceipt;
  // Missing the following fields:
  // contractAddress: string;
  // transactionIndex: number;
  // root?: string;
  // logs: Array<Log>;
  // confirmations: number;
  // cumulativeGasUsed: BigNumber;
  // byzantium: boolean;
  // status?: number;
};

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

  async findLatestTransactionToChannel(
    multisigAddress: string,
    reason: TransactionReason,
  ): Promise<OnchainTransaction | undefined> {
    const tx = await this.createQueryBuilder("onchainTransaction")
      .leftJoinAndSelect("onchainTransaction.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .where("onchainTransaction.reason = :reason", { reason })
      .orderBy("onchainTransaction.nonce", "DESC")
      .getOne();
    return tx;
  }

  async findLatestWithdrawalByUserPublicIdentifierAndChain(
    userIdentifier: string,
    chainId: number,
  ): Promise<OnchainTransaction | undefined> {
    const tx = await this.createQueryBuilder("onchainTransaction")
      .leftJoinAndSelect("onchainTransaction.channel", "channel")
      .where("channel.userIdentifier = :userIdentifier", { userIdentifier })
      .andWhere("channel.chainId = :chainId", { chainId })
      .andWhere("onchainTransaction.reason = :reason", {
        reason: TransactionReason.USER_WITHDRAWAL,
      })
      .orderBy("onchainTransaction.id", "DESC")
      .getOne();
    return tx;
  }

  async addPending(
    tx: providers.TransactionResponse,
    reason: TransactionReason,
    channel: Channel,
  ): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      const { identifiers } = await transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(OnchainTransaction)
        .values({
          ...tx,
          gasUsed: Zero,
          reason,
          status: TransactionStatus.PENDING,
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

  async markFailed(
    tx: providers.TransactionResponse,
    errors: { [k: number]: string },
  ): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          status: TransactionStatus.FAILED,
          errors,
        })
        .where("onchain_transaction.hash = :txHash", {
          txHash: tx.hash,
        })
        .execute();
    });
  }

  async addReceipt(tx: providers.TransactionReceipt): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          status: TransactionStatus.SUCCESS,
          gasUsed: tx.gasUsed || Zero,
          logsBloom: tx.logsBloom,
        })
        .where("onchain_transaction.hash = :txHash", {
          txHash: tx.transactionHash,
        })
        .execute();
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
