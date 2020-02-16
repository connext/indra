import { RebalanceProfile, IConnextClient } from "@connext/types";
import { Client } from "ts-nats";

import { expect } from "..";

export const addRebalanceProfile = async (nats: Client, client: IConnextClient, profile: RebalanceProfile) => {
  await nats.request(
    `channel.add-profile.${client.publicIdentifier}`,
    5000,
    JSON.stringify({
      id: Date.now(),
      profile,
      token: "foo",
    }),
  );

  const returnedProfile = await client.getRebalanceProfile(profile.assetId);
  expect(returnedProfile).to.deep.eq(profile);
};
