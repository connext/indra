import { connect, Client } from "ts-nats";
import { env } from "./env";

export let natsClient: Client;

export const connectNats = async (): Promise<Client> => {
  if (!natsClient) {
    natsClient = await connect({ servers: [env.nodeUrl] });
  }
  return natsClient;
};
