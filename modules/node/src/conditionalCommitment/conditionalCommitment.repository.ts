import { EntityRepository, Repository } from "typeorm";
import { ConditionalTransactionCommitmentEntity } from "./conditionalCommitment.entity";
import { ConditionalTransactionCommitmentJSON, ContractAddresses } from "@connext/types";
import { AppInstance } from "../appInstance/appInstance.entity";

export const convertConditionalCommitmentToJson = (
  commitment: ConditionalTransactionCommitmentEntity,
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

@EntityRepository(ConditionalTransactionCommitmentEntity)
export class ConditionalTransactionCommitmentRepository extends Repository<
  ConditionalTransactionCommitmentEntity
> {
  findByAppIdentityHash(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentEntity | undefined> {
    return this.createQueryBuilder("conditional")
      .leftJoinAndSelect("conditional.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
  }

  findByMultisigAddress(
    multisigAddress: string,
  ): Promise<ConditionalTransactionCommitmentEntity[]> {
    return this.find({
      where: {
        multisigAddress,
      },
    });
  }

  async getConditionalTransactionCommitment(
    appIdentityHash: string,
  ): Promise<ConditionalTransactionCommitmentEntity | undefined> {
    const commitment = await this.findByAppIdentityHash(appIdentityHash);
    if (!commitment) {
      return undefined;
    }
    return commitment;
  }

  async saveConditionalTransactionCommitment(
    app: AppInstance,
    commitment: ConditionalTransactionCommitmentJSON,
  ): Promise<ConditionalTransactionCommitmentEntity> {
    let commitmentEntity = await this.findByAppIdentityHash(app.identityHash);
    if (!commitmentEntity) {
      commitmentEntity = new ConditionalTransactionCommitmentEntity();
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
