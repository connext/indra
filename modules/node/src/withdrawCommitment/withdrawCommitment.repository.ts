import { MinimalTransaction } from "@connext/types";
import { bigNumberify } from "ethers/utils";
import { EntityRepository, Repository } from "typeorm";

import { WithdrawCommitment } from "./withdrawCommitment.entity";
import { Channel } from "../channel/channel.entity";

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
  findByMultisigAddress(multisigAddress: string): Promise<WithdrawCommitment> {
    return this.createQueryBuilder("withdraw")
      .leftJoinAndSelect("withdraw.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getOne();
  }

  async getWithdrawalCommitmentTx(
    multisigAddress: string,
  ): Promise<MinimalTransaction> {
    const withdrawal = await this.findByMultisigAddress(multisigAddress);
    if (!withdrawal) {
      return undefined;
    }
    return convertWithdrawToMinimalTransaction(withdrawal);
  }
}
