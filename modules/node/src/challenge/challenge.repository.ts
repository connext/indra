import { Challenge } from "./challenge.entity";
import { Repository, EntityRepository } from "typeorm";
import { StoredAppChallenge } from "@connext/types";

export const entityToStoredChallenge = (
  item: Challenge | undefined,
): StoredAppChallenge | undefined => {
  if (!item) {
    return undefined;
  }
  const { app, versionNumber, appStateHash, finalizesAt, status } = item;
  return {
    identityHash: app.identityHash,
    versionNumber,
    appStateHash,
    finalizesAt,
    status,
  };
};

@EntityRepository(Challenge)
export class ChallengeRepository extends Repository<Challenge> {
  findByIdentityHash(appIdentityHash: string): Promise<Challenge | undefined> {
    return this.createQueryBuilder("challenge")
      .leftJoinAndSelect(
        "challenge.stateProgressedEvents",
        "state_progressed_event",
      )
      .leftJoinAndSelect(
        "challenge.challengeUpdatedEvents",
        "challenge_updated_event",
      )
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

  findActiveChallengesByMultisig(multisigAddress: string): Promise<Challenge[]> {
    return this.createQueryBuilder("challenge")
      .leftJoinAndSelect(
        "challenge.channel",
        "channel",
        "channel.multisigAddress = :multisigAddress",
        { multisigAddress },
      )
      .getMany();
  }
}
