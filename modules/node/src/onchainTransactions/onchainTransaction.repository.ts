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
import { MinimalTransaction } from "@connext/types";
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
    const txes = await this.createQueryBuilder("onchain_transaction")
      .leftJoinAndSelect("onchain_transaction.channel", "channel")
      .where("onchain_transaction.status = :status", { status: TransactionStatus.FAILED })
      .getMany();

    // could do this in the query, but it was hard and probably doesn't matter
    return txes.filter((tx) =>
      Object.values(tx.errors).some((error) => withErrors.includes(error)),
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

  async findByAppId(appIdentityHash: string): Promise<OnchainTransaction | undefined> {
    const tx = await this.createQueryBuilder("onchainTransaction")
      .where("onchainTransaction.appIdentityHash = :appIdentityHash", {
        appIdentityHash,
      })
      .getOne();
    return tx;
  }

  // Use reason here because channels can collide with multisig/nonce,
  // but cannot collide with multisig/nonce + reason due to protocol
  // level locks.
  // TODO: (Med) Generate the transaction hash ahead of time
  async findByChannelReasonAndNonce(
    multisigAddress: string,
    reason: TransactionReason,
    nonce: number,
  ): Promise<OnchainTransaction | undefined> {
    const tx = await this.createQueryBuilder("onchainTransaction")
      .where('"onchainTransaction"."channelMultisigAddress" = :multisigAddress', {
        multisigAddress,
      })
      .andWhere("onchainTransaction.reason = :reason", { reason })
      .andWhere("onchainTransaction.nonce = :nonce", { nonce })
      .getOne();
    return tx;
  }

  async addAppUninstallFlag(appUninstalled: boolean, hash: string): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          appUninstalled,
        })
        .where("onchain_transaction.hash = :hash", {
          hash,
        })
        .execute();
    });
  }

  async addPending(
    tx: MinimalTransaction,
    nonce: number,
    from: string,
    reason: TransactionReason,
    channel: Channel,
    appIdentityHash?: string,
  ): Promise<void> {
    const existing = await this.findByChannelReasonAndNonce(channel.multisigAddress, reason, nonce);
    return getManager().transaction(async (transactionalEntityManager) => {
      if (existing) {
        await transactionalEntityManager
          .createQueryBuilder()
          .update(OnchainTransaction)
          .set({
            to: tx.to,
            data: tx.data.toString(),
            value: toBN(tx.value),
            chainId: channel.chainId.toString(),
            from,
            nonce,
            reason,
            status: TransactionStatus.PENDING,
            channel,
            gasUsed: Zero,
            appIdentityHash,
          })
          .execute();
      } else {
        await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(OnchainTransaction)
          .values({
            to: tx.to,
            data: tx.data.toString(),
            value: toBN(tx.value),
            chainId: channel.chainId.toString(),
            from,
            nonce,
            reason,
            status: TransactionStatus.PENDING,
            channel,
            gasUsed: Zero,
            appIdentityHash,
          })
          .execute();
      }
    });
  }

  async addResponse(
    tx: providers.TransactionResponse,
    nonce: number,
    reason: TransactionReason,
    channel: Channel,
    appIdentityHash?: string,
  ): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          from: tx.from,
          to: tx.to,
          data: tx.data.toString(),
          value: toBN(tx.value),
          gasPrice: toBN(tx.gasPrice),
          gasLimit: toBN(tx.gasLimit),
          nonce: toBN(tx.nonce).toNumber(),
          chainId: tx.chainId.toString(),
          reason,
          status: TransactionStatus.PENDING,
          channel,
          hash: tx.hash,
          blockHash: tx.blockHash,
          blockNumber: tx.blockNumber,
          raw: tx.raw,
          gasUsed: Zero,
          appIdentityHash,
        })
        .where('"onchain_transaction"."channelMultisigAddress" = :multisigAddress', {
          multisigAddress: channel.multisigAddress,
        })
        .andWhere("onchain_transaction.nonce = :nonce", { nonce })
        .andWhere("onchain_transaction.from = :from", { from: tx.from })
        .execute();
    });
  }

  async markFailedByChannelFromAndNonce(
    multisigAddress: string,
    from: string,
    nonce: number,
    errors: { [k: number]: string },
    appIdentityHash?: string,
  ): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          appIdentityHash,
          status: TransactionStatus.FAILED,
          errors,
        })
        .where('"onchain_transaction"."channelMultisigAddress" = :multisigAddress', {
          multisigAddress,
        })
        .andWhere("onchain_transaction.nonce = :nonce", { nonce })
        .andWhere("onchain_transaction.from = :from", { from })
        .execute();
    });
  }

  async markFailedByTxHash(
    tx: providers.TransactionResponse,
    errors: { [k: number]: string },
    appIdentityHash?: string,
  ): Promise<void> {
    return getManager().transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager
        .createQueryBuilder()
        .update(OnchainTransaction)
        .set({
          appIdentityHash,
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
          blockNumber: tx.blockNumber,
          blockHash: tx.blockHash,
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
