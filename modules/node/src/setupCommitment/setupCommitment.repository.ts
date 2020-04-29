import { MinimalTransaction } from "@connext/types";
import { BigNumber } from "ethers";
import { EntityRepository, Repository } from "typeorm";

import { SetupCommitment } from "./setupCommitment.entity";

export const convertSetupEntityToMinimalTransaction = (commitment: SetupCommitment) => {
  return {
    to: commitment.to,
    value: commitment.value,
    data: commitment.data,
  };
};

@EntityRepository(SetupCommitment)
export class SetupCommitmentRepository extends Repository<SetupCommitment> {
  findByMultisigAddress(multisigAddress: string): Promise<SetupCommitment> {
    return this.findOne({
      where: { multisigAddress },
      relations: ["channel"],
    });
  }

  async findByMultisigAddressOrThrow(multisigAddress: string): Promise<SetupCommitment> {
    const setupCommitment = await this.findByMultisigAddress(multisigAddress);
    if (!setupCommitment) {
      throw new Error(`Could not find setup commitment for ${multisigAddress}`);
    }
    return setupCommitment;
  }

  async getCommitment(multisigAddress: string): Promise<MinimalTransaction> {
    const setup = await this.findByMultisigAddress(multisigAddress);
    if (!setup) {
      return undefined;
    }
    return convertSetupEntityToMinimalTransaction(setup);
  }

  async createCommitment(
    multisigAddress: string,
    commitment: MinimalTransaction,
  ): Promise<SetupCommitment> {
    const commitmentEnt = new SetupCommitment();
    commitmentEnt.multisigAddress = multisigAddress;
    commitmentEnt.to = commitment.to;
    commitmentEnt.value = BigNumber.from(commitment.value);
    commitmentEnt.data = commitment.data;
    return this.save(commitmentEnt);
  }
}
