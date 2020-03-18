import { EntityRepository, Repository } from "typeorm";

import { Withdraw } from "./withdraw.entity";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";

@EntityRepository(Withdraw)
export class WithdrawRepository extends Repository<Withdraw> {
  async findByAppInstanceId(appInstanceId: string): Promise<Withdraw | undefined> {
    return await this.findOne({ where: { appInstanceId } });
  }

  async findAll(): Promise<Withdraw[]> {
    return await this.find();
  }

  async addCounterpartySignatureAndFinalize(
    withdraw: Withdraw,
    signature: string,
  ): Promise<Withdraw> {
    withdraw.counterpartySignature = signature;
    withdraw.finalized = true;
    return await this.save(withdraw);
  }

  async addOnchainTransaction(
    withdraw: Withdraw,
    onchainTransaction: OnchainTransaction,
  ): Promise<Withdraw> {
    withdraw.onchainTransaction = onchainTransaction;
    return await this.save(withdraw);
  }
}
