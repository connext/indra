import { StoredAppChallenge, ChallengeStatus } from "@connext/types";
import { Repository, EntityRepository, getRepository } from "typeorm";
import { Challenge, ProcessedBlock } from "./challenge.entity";
import { Channel } from "../channel/channel.entity";

export const entityToStoredChallenge = (entity: Challenge): StoredAppChallenge => {
  const { app, versionNumber, appStateHash, finalizesAt, status } = entity;
  return {
    identityHash: app.identityHash,
    versionNumber,
    appStateHash,
    finalizesAt,
    status,
  };
};

@EntityRepository(ProcessedBlock)
export class ProcessedBlockRepository extends Repository<ProcessedBlock> {
  async findLatestProcessedBlock(): Promise<ProcessedBlock> {
    return this.createQueryBuilder("processedBlock")
      .select("MAX(processedBlock.blockNumber)")
      .getRawOne();
  }
}

@EntityRepository(Challenge)
export class ChallengeRepository extends Repository<Challenge> {
  findByIdentityHash(appIdentityHash: string): Promise<Challenge | undefined> {
    return this.createQueryBuilder("challenge")
      .leftJoinAndSelect("challenge.stateProgressedEvents", "state_progressed_event")
      .leftJoinAndSelect("challenge.challengeUpdatedEvents", "challenge_updated_event")
      .leftJoinAndSelect(
        "challenge.app",
        "app_instance",
        "app_instance.identityHash = :appIdentityHash",
        { appIdentityHash },
      )
      .getOne();
  }

  async findByIdentityHashOrThrow(appIdentityHash: string): Promise<Challenge> {
    const challenge = await this.findByIdentityHash(appIdentityHash);
    if (!challenge) {
      throw new Error(`Could not find challenge for app ${appIdentityHash}`);
    }
    return challenge;
  }

  async findActiveChallengesByMultisig(multisigAddress: string): Promise<Challenge[]> {
    // TODO: make this one query

    const channel = await getRepository(Channel)
      .createQueryBuilder("channel")
      .leftJoinAndSelect("channel.appInstances", "appInstance")
      .where("channel.multisigAddress = :multisigAddress", { multisigAddress })
      .getOne();
    const ids = channel.appInstances.map(app => app.identityHash);

    return this.createQueryBuilder("challenge")
      .leftJoinAndSelect("challenge.stateProgressedEvents", "state_progressed_event")
      .leftJoinAndSelect("challenge.challengeUpdatedEvents", "challenge_updated_event")
      .leftJoinAndSelect("challenge.app", "app_instance")
      .where("challenge.status IN (:...statuses)", {
        statuses: [
          ChallengeStatus.EXPLICITLY_FINALIZED,
          ChallengeStatus.IN_DISPUTE,
          ChallengeStatus.IN_ONCHAIN_PROGRESSION,
        ],
      })
      .where("challenge.app IN (:...ids)", { ids })
      .getMany();
  }
}
