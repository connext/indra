import { EntityRepository, Repository } from "typeorm";
import { ConditionalTransactionCommitment } from "./conditionalCommitment.entity";
import { ConditionalTransactionCommitmentJSON, ContractAddresses } from "@connext/types";

export const convertConditionalCommitmentToJson = (
  commitment: ConditionalTransactionCommitment,
  networkContext: ContractAddresses,
): ConditionalTransactionCommitmentJSON => {
  return {
    appIdentityHash: commitment.app.identityHash,
    freeBalanceAppIdentityHash: commitment.freeBalanceAppIdentityHash,
    networkContext,
    signatures: commitment.signatures,
    interpreterAddr: commitment.interpreterAddr,
    interpreterParams: commitment.interpreterParams,
    multisigAddress: commitment.multisigAddress,
    multisigOwners: commitment.multisigOwners,
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
}
