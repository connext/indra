import { RebalanceProfile, IConnextClient } from "@connext/types";

import { expect } from "..";
import { env } from "../env";
import Axios from "axios";

export const addRebalanceProfile = async (
  client: IConnextClient,
  profile: RebalanceProfile,
  assertProfile: boolean = true,
) => {
  try {
    const msg = await Axios.post(
      `${env.nodeUrl}/admin/rebalance-profile`,
      {
        multisigAddress: client.multisigAddress,
        rebalanceProfile: profile,
      },
      {
        headers: {
          "x-auth-token": env.adminToken,
        },
      },
    );
    if (assertProfile) {
      const returnedProfile = await client.getRebalanceProfile(profile.assetId);
      expect(returnedProfile).to.deep.include(profile);
    }

    return msg.data;
  } catch (e) {
    return e.response.data.message;
  }
};
