import { ProtocolTypes } from "@connext/types";
import { bigNumberify } from "ethers/utils";
import { EntityRepository, Repository } from "typeorm";

import { SetupCommitmentEntity } from "./setupCommitment.entity";
import { Channel } from "../channel/channel.entity";

export const convertSetupEntityToMinimalTransaction = (commitment: SetupCommitmentEntity) => {
  return {
    to: commitment.to,
    value: commitment.value,
    data: commitment.data,
  };
};

@EntityRepository(SetupCommitmentEntity)
export class SetupCommitmentEntityRepository extends Repository<SetupCommitmentEntity> {
  findByMultisigAddress(multisigAddress: string): Promise<SetupCommitmentEntity> {
    return this.findOne({
      where: { multisigAddress },
      relations: ["channel"],
    });
  }

  async getCommitment(multisigAddress: string): Promise<ProtocolTypes.MinimalTransaction> {
    const setup = await this.findByMultisigAddress(multisigAddress);
    if (!setup) {
      return undefined;
    }
    return convertSetupEntityToMinimalTransaction(setup);
  }

  async saveCommitment(
    multisigAddress: string,
    commitment: ProtocolTypes.MinimalTransaction,
    channel?: Channel,
  ): Promise<SetupCommitmentEntity> {
    let commitmentEnt = await this.findByMultisigAddress(multisigAddress);
    if (!commitmentEnt) {
      commitmentEnt = new SetupCommitmentEntity();
      commitmentEnt.multisigAddress = multisigAddress;
    }
    commitmentEnt.channel = channel;
    commitmentEnt.to = commitment.to;
    commitmentEnt.value = bigNumberify(commitment.value);
    commitmentEnt.data = commitment.data;
    return this.save(commitmentEnt);
  }
}
