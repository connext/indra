import { providers, constants } from "ethers";
import { EntityRepository, Repository, Between, getManager } from "typeorm";

import { Channel } from "../channel/channel.entity";

import {
  OnchainTransaction,
  TransactionReason,
  AnonymizedOnchainTransaction,
  TransactionStatus,
} from "./onchainTransaction.entity";
import { toBN } from "@connext/utils";
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

  async findFailedTransactions(withErrors: string[]): Promise<OnchainTransaction[]> {
    return (
      this.createQueryBuilder("onchain_transaction")
        .leftJoinAndSelect("onchain_transaction.channel", "channel")
        .where("onchain_transaction.status = :status", { status: TransactionStatus.FAILED })
        // FIXME: search for error messages within stored txs!!
        // .andWhere(
        //   `onchain_transaction."errors"::JSONB @> '{"coinTransfers",0,"to"}' = '"${nodeSignerAddress}"'`,
        // )
        .getMany()
    );
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

  async addResponse(tx: providers.TransactionResponse): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          hash: tx.hash,
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber,
          raw: tx.raw,
          chainId: tx.chainId.toString(),
          gasUsed: Zero,
        })
        .where("onchain_transaction.data = :data", { data: tx.data })
        .andWhere("onchain_transaction.to = :to", { to: tx.to })
        .andWhere("onchain_transaction.value = :value", { value: tx.value })
        .execute();
    });
  }

  async addRequest(
    tx: providers.TransactionRequest,
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
          data: tx.data.toString(),
          value: toBN(tx.value),
          gasPrice: toBN(tx.gasPrice),
          gasLimit: toBN(tx.gasLimit),
          nonce: toBN(tx.nonce).toNumber(),
          chainId: tx.chainId.toString(),
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
