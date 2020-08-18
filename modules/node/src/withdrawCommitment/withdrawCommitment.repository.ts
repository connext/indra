import { MinimalTransaction } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { WithdrawCommitment } from "./withdrawCommitment.entity";

export const convertWithdrawToMinimalTransaction = (commitment: WithdrawCommitment) => {
  return {
    to: commitment.to,
    value: commitment.value,
    data: commitment.data,
  };
};

@EntityRepository(WithdrawCommitment)
export class WithdrawCommitmentRepository extends Repository<WithdrawCommitment> {
  // TODO: assumes there will only be one withdrawal commitment per multisig
  findByMultisigAddress(multisigAddress: string): Promise<WithdrawCommitment | undefined> {
    return this.createQueryBuilder("withdraw")
      .leftJoinAndSelect("withdraw.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getOne();
  }

  async getWithdrawalCommitmentTx(
    multisigAddress: string,
  ): Promise<MinimalTransaction | undefined> {
    const withdrawal = await this.findByMultisigAddress(multisigAddress);
    if (!withdrawal) {
      return undefined;
    }
    return convertWithdrawToMinimalTransaction(withdrawal);
  }
}
