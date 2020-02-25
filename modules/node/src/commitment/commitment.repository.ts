import { EntityRepository, Repository } from "typeorm";
import { Commitment, CommitmentType } from "./commitment.entity";
import { ProtocolTypes } from "@connext/types";

@EntityRepository(Commitment)
export class CommitmentRepository extends Repository<Commitment> {
  findByMultisigAddress(multisigAddress: string): Promise<Commitment> {
    return this.findOne({
      where: {
        multisigAddress,
      },
    });
  }

  findByCommitmentHash(commitmentHash: string): Promise<Commitment> {
    return this.findOne({
      where: {
        commitmentHash,
      },
    });
  }

  async getWithdrawalCommitment(
    multisigAddress: string,
  ): Promise<ProtocolTypes.MinimalTransaction> {
    const commitment = await this.findByMultisigAddress(multisigAddress);
    if (!commitment) {
      return undefined;
    }

    return commitment.data as ProtocolTypes.MinimalTransaction;
  }

  async saveWithdrawalCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
  ): Promise<void> {
    const commitmentEnt = new Commitment();
    commitmentEnt.type = CommitmentType.COMMITMENT;
    commitmentEnt.multisigAddress = multisigAddress;
    commitmentEnt.data = commitment;
    this.save(commitmentEnt);
  }

  async getCommitment(commitmentHash: string): Promise<ProtocolTypes.MinimalTransaction> {
    const commitment = await this.findByCommitmentHash(commitmentHash);
    if (!commitment) {
      return undefined;
    }

    return commitment.data as ProtocolTypes.MinimalTransaction;
  }

  async saveCommitment(commitmentHash: string, commitment: any[]): Promise<void> {
    const commitmentEnt = new Commitment();
    commitmentEnt.type = CommitmentType.COMMITMENT;
    commitmentEnt.commitmentHash = commitmentHash;
    commitmentEnt.data = commitment;
    this.save(commitmentEnt);
  }
}
