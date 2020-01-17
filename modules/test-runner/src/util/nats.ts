import { Client, connect } from "ts-nats";

import { env } from "./env";

let natsConnection: Client;

export const createOrRetrieveNatsConnection = async (): Promise<Client> => {
  if (natsConnection) {
    return natsConnection;
  }

  natsConnection = await connect({ servers: [env.nodeUrl] });
  return natsConnection;
};
