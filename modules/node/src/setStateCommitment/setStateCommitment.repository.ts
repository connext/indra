import { SetStateCommitmentJSON } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { SetStateCommitment } from "./setStateCommitment.entity";
import { AppInstance } from "../appInstance/appInstance.entity";

export const setStateToJson = (entity: SetStateCommitment): SetStateCommitmentJSON => {
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

@EntityRepository(SetStateCommitment)
export class SetStateCommitmentRepository extends Repository<SetStateCommitment> {
  findByAppIdentityHash(appIdentityHash: string): Promise<SetStateCommitment | undefined> {
    return this.createQueryBuilder("set_state")
      .leftJoinAndSelect("set_state.app", "app")
      .where("app.identityHash = :appIdentityHash", { appIdentityHash })
      .getOne();
  }

  findByAppStateHash(appStateHash: string): Promise<SetStateCommitment | undefined> {
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
      entity = new SetStateCommitment();
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
