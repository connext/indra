import { VerifyNonceDtoType } from "@connext/types";
import { connect, Client } from "ts-nats";
import axios, { AxiosResponse } from "axios";

import { env } from "./env";

let natsClient: Client | undefined = undefined;

export const getNatsClient = (): Client => {
  if (!natsClient) {
    throw new Error(`NATS is not connected, use connectNats first`);
  }

  return natsClient;
};

export const connectNats = async (): Promise<Client> => {
  if (!natsClient) {
    const adminJWT: AxiosResponse<string> = await axios.post(`${env.nodeUrl}/auth`, {
      sig: "0xbeef",
      userPublicIdentifier: "xpubAdmin",
      adminToken: env.adminToken,
    } as VerifyNonceDtoType);
    natsClient = await connect({ servers: ["nats://172.17.0.1:4222"], userJWT: adminJWT.data });
  }
  return natsClient;
};

export const closeNats = (): void => {
  if (natsClient) {
    natsClient.close();
  }
  natsClient = undefined;
};
