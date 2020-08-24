import { EntityRepository, Repository } from "typeorm";

import { Withdraw } from "./withdraw.entity";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";

@EntityRepository(Withdraw)
export class WithdrawRepository extends Repository<Withdraw> {
  async findByAppIdentityHash(appIdentityHash: string): Promise<Withdraw | undefined> {
    return this.findOne({ where: { appIdentityHash } });
  }

  async findAll(): Promise<Withdraw[]> {
    return this.find();
  }

  async addCounterpartySignatureAndFinalize(
    withdraw: Withdraw,
    signature: string,
  ): Promise<Withdraw> {
    withdraw.counterpartySignature = signature;
    withdraw.finalized = true;
    return this.save(withdraw);
  }

  async addUserOnchainTransaction(
    withdraw: Withdraw,
    onchainTransaction: OnchainTransaction,
  ): Promise<Withdraw> {
    if (withdraw.onchainTransaction?.hash === onchainTransaction.hash) {
      return withdraw;
    }
    withdraw.onchainTransaction = onchainTransaction;
    return this.save(withdraw);
  }
}
