import { StoredAppChallenge, StoredAppChallengeStatus } from "@connext/types";
import { Repository, EntityRepository } from "typeorm";
import { Challenge, ProcessedBlock } from "./challenge.entity";

export const entityToStoredChallenge = (entity: Challenge): StoredAppChallenge => {
  const { app, versionNumber, appStateHash, finalizesAt, status, channel } = entity;
  return {
    identityHash: app.identityHash,
    versionNumber,
    appStateHash,
    finalizesAt,
    status,
    chainId: channel.chainId,
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
      .leftJoinAndSelect("challenge.channel", "channel")
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

  async findActiveChallenges(): Promise<Challenge[]> {
    return this.createQueryBuilder("challenge")
      .leftJoinAndSelect("challenge.stateProgressedEvents", "state_progressed_event")
      .leftJoinAndSelect("challenge.challengeUpdatedEvents", "challenge_updated_event")
      .leftJoinAndSelect("challenge.app", "app_instance")
      .leftJoinAndSelect("challenge.channel", "channel")
      .where("challenge.status IN (:...statuses)", {
        statuses: [
          StoredAppChallengeStatus.OUTCOME_SET,
          StoredAppChallengeStatus.EXPLICITLY_FINALIZED,
          StoredAppChallengeStatus.IN_DISPUTE,
          StoredAppChallengeStatus.IN_ONCHAIN_PROGRESSION,
        ],
      })
      .getMany();
  }
}
