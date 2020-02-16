import { RebalanceProfile, IConnextClient } from "@connext/types";
import { Client } from "ts-nats";

import { expect } from "..";
import { env } from "../env";

export const addRebalanceProfile = async (
  nats: Client,
  client: IConnextClient,
  profile: RebalanceProfile,
  assertProfile: boolean = true,
) => {
  const msg = await nats.request(
    `channel.add-profile.${client.publicIdentifier}`,
    5000,
    JSON.stringify({
      id: Date.now(),
      profile,
      token: env.adminToken,
    }),
  );

  if (assertProfile) {
    const returnedProfile = await client.getRebalanceProfile(profile.assetId);
    expect(returnedProfile).to.deep.eq(profile);
  }

  return msg.data;
};
