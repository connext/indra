import { VerifyNonceDtoType } from "@connext/types";
import { getRandomChannelSigner } from "@connext/utils";
import { connect, Client } from "ts-nats";
import axios, { AxiosResponse } from "axios";

import { env } from "./env";

let natsClient: Client | undefined = undefined;

export const getNatsClient = (): Client => {
  if (!natsClient || natsClient.isClosed()) {
    throw new Error(`NATS is not connected, use connectNats first`);
  }

  return natsClient;
};

export const connectNats = async (): Promise<Client> => {
  const signer = getRandomChannelSigner();
  if (!natsClient) {
    const adminJWT: AxiosResponse<string> = await axios.post(`${env.nodeUrl}/auth`, {
      sig: "0xbeef",
      userIdentifier: signer.publicIdentifier,
      adminToken: env.adminToken,
    } as VerifyNonceDtoType);
    natsClient = await connect({ servers: [env.natsUrl], userJWT: adminJWT.data });
  }
  return natsClient;
};

export const closeNats = (): void => {
  if (natsClient) {
    natsClient.close();
  }
  natsClient = undefined;
};
