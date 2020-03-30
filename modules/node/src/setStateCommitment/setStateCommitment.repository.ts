import { SetStateCommitmentJSON } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { SetStateCommitment } from "./setStateCommitment.entity";

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
}
