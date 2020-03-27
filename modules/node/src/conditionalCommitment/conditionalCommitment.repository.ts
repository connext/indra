import { EntityRepository, Repository } from "typeorm";
import { ConditionalTransactionCommitment } from "./conditionalCommitment.entity";
import { ConditionalTransactionCommitmentJSON, ContractAddresses } from "@connext/types";
import { AppInstance } from "../appInstance/appInstance.entity";

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

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitment | undefined> {
    const commitment = await this.findByAppIdentityHash(appIdentityHash);
    if (!commitment) {
      return undefined;
    }
    return commitment;
  }

  async saveConditionalTransactionCommitment(
    app: AppInstance,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<ConditionalTransactionCommitment> {
    let commitmentEntity = await this.findByAppIdentityHash(app.identityHash);
    if (!commitmentEntity) {
      commitmentEntity = new ConditionalTransactionCommitment();
      commitmentEntity.app = app;
      commitmentEntity.freeBalanceAppIdentityHash = commitment.freeBalanceAppIdentityHash;
      commitmentEntity.multisigAddress = commitment.multisigAddress;
      commitmentEntity.multisigOwners = commitment.multisigOwners;
      commitmentEntity.interpreterAddr = commitment.interpreterAddr;
    }
    commitmentEntity.interpreterParams = commitment.interpreterParams;
    commitmentEntity.signatures = commitment.signatures;
    return this.save(commitmentEntity);
  }
}
