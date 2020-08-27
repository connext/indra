import { IConnextClient } from "@connext/types";
import { Client } from "ts-nats";

import { env } from "../env";

export const nodeInitiatesChallenge = async (
  appIdentityHash: string,
  nats: Client,
  client: IConnextClient,
) => {
  const msg = await nats.request(
    `${client.nodeIdentifier}.${client.chainId}.challenge.initiate`,
    5000,
    JSON.stringify({
      id: Date.now(),
      appIdentityHash,
      multisigAddress: client.multisigAddress,
      token: env.adminToken,
    }),
  );

  return msg.data;
};
