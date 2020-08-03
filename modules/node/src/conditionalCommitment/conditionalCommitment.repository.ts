import { EntityRepository, Repository } from "typeorm";
import { ConditionalTransactionCommitment } from "./conditionalCommitment.entity";
import { ConditionalTransactionCommitmentJSON } from "@connext/types";
import { AppType } from "../appInstance/appInstance.entity";

export const convertConditionalCommitmentToJson = (
  commitment: ConditionalTransactionCommitment,
): ConditionalTransactionCommitmentJSON => {
  return {
    appIdentityHash: commitment.app.identityHash,
    freeBalanceAppIdentityHash: commitment.freeBalanceAppIdentityHash,
    contractAddresses: commitment.contractAddresses,
    signatures: commitment.signatures,
    interpreterAddr: commitment.interpreterAddr,
    interpreterParams: commitment.interpreterParams,
    multisigAddress: commitment.multisigAddress,
    multisigOwners: commitment.multisigOwners,
    transactionData: commitment.transactionData,
  };
};

@EntityRepository(ConditionalTransactionCommitment)
export class ConditionalTransactionCommitmentRepository extends Repository<
  ConditionalTransactionCommitment
> {
  findByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitment | undefined> {
    return this.createQueryBuilder("conditional")
      .leftJoinAndSelect("conditional.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
  }

  findByMultisigAddress(multisigAddress: string): Promise<ConditionalTransactionCommitment[]> {
    return this.find({
      where: {
        multisigAddress,
      },
    });
  }

  async findAllActiveCommitmentsByMultisig(
    multisigAddress: string,
  ): Promise<ConditionalTransactionCommitment[]> {
    return this.createQueryBuilder("conditional")
      .leftJoinAndSelect("conditional.app", "app")
      .where("app.type <> :uninstalled", { uninstalled: AppType.UNINSTALLED })
      .leftJoinAndSelect("app.channel", "channel")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getMany();
  }
}
