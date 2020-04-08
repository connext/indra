import { SetStateCommitmentJSON } from "@connext/types";
import { EntityRepository, Repository } from "typeorm";

import { SetStateCommitment } from "./setStateCommitment.entity";
import { AppType } from "../appInstance/appInstance.entity";

export const setStateToJson = (entity: SetStateCommitment): SetStateCommitmentJSON => {
  return {
    appIdentity: entity.appIdentity as any,
    appIdentityHash: entity.app.identityHash,
    appStateHash: entity.appStateHash,
    challengeRegistryAddress: entity.challengeRegistryAddress,
    signatures: entity.signatures as any,
    stateTimeout: entity.stateTimeout,
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

  findByMultisigAddress(multisigAddress: string): Promise<SetStateCommitment[]> {
    return this.createQueryBuilder("set_state")
      .leftJoinAndSelect("set_state.app", "app")
      .where(
        "app.channel.multisigAddress = :multisigAddress", { multisigAddress },
      )
      .getMany();
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

  async findAllActiveCommitmentsByMultisig(multisigAddress: string): Promise<SetStateCommitment[]> {
    return this.createQueryBuilder("set_state")
      .leftJoinAndSelect("set_state.app", "app")
      .where(
        "app.type <> :rejected", { rejected: AppType.REJECTED },
      )
      .andWhere("app.type <> :uninstalled", { uninstalled: AppType.UNINSTALLED })
      .leftJoinAndSelect("app.channel", "channel")
      .where(
        "channel.multisigAddress = :multisigAddress", { multisigAddress },
      )
      .getMany();
  }
}
