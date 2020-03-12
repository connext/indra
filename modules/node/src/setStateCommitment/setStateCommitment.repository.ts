import { SetStateCommitmentJSON } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { SetStateCommitmentEntity } from "./setStateCommitment.entity";
import { AppInstance } from "../appInstance/appInstance.entity";

export const setStateToJson = (entity: SetStateCommitmentEntity): SetStateCommitmentJSON => {
  return {
    appIdentity: entity.appIdentity as any,
    appIdentityHash: entity.app.identityHash,
    appStateHash: entity.appStateHash,
    challengeRegistryAddress: entity.challengeRegistryAddress,
    signatures: entity.signatures as any,
    timeout: entity.timeout,
    versionNumber: entity.versionNumber,
  };
};

@EntityRepository(SetStateCommitmentEntity)
export class SetStateCommitmentRepository extends Repository<SetStateCommitmentEntity> {
  findByAppIdentityHash(appIdentityHash: string): Promise<SetStateCommitmentEntity | undefined> {
    return this.createQueryBuilder("set_state")
      .leftJoinAndSelect("set_state.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
  }

  findByAppStateHash(appStateHash: string): Promise<SetStateCommitmentEntity | undefined> {
    return this.findOne({
      where: {
        appStateHash,
      },
    });
  }

  async getLatestSetStateCommitment(
    appIdentityHash: string,
  ): Promise<SetStateCommitmentJSON | undefined> {
    const commitment = await this.findByAppIdentityHash(appIdentityHash);
    if (!commitment) {
      return undefined;
    }
    return setStateToJson(commitment);
  }

  async saveLatestSetStateCommitment(
    app: AppInstance,
    commitment: SetStateCommitmentJSON,
  ): Promise<void> {
    let entity = await this.findByAppIdentityHash(app.identityHash);
    if (!entity) {
      entity = new SetStateCommitmentEntity();
      entity.app = app;
      entity.appIdentity = commitment.appIdentity;
    }
    entity.appStateHash = commitment.appStateHash;
    entity.challengeRegistryAddress = commitment.challengeRegistryAddress;
    entity.signatures = commitment.signatures;
    entity.timeout = commitment.timeout;
    entity.versionNumber = commitment.versionNumber;
    this.save(entity);
  }
}
