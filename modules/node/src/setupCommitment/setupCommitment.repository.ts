import { ProtocolTypes } from "@connext/types";
import { bigNumberify } from "ethers/utils";
import { EntityRepository, Repository } from "typeorm";

import { SetupCommitment } from "./setupCommitment.entity";
import { Channel } from "../channel/channel.entity";

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
  ): Promise<SetupCommitment> {
    let commitmentEnt = await this.findByMultisigAddress(multisigAddress);
    if (!commitmentEnt) {
      commitmentEnt = new SetupCommitment();
      commitmentEnt.multisigAddress = multisigAddress;
    }
    commitmentEnt.channel = channel;
    commitmentEnt.to = commitment.to;
    commitmentEnt.value = bigNumberify(commitment.value);
    commitmentEnt.data = commitment.data;
    return this.save(commitmentEnt);
  }
}
