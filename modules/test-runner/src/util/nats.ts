import { connect, Client } from "ts-nats";
import { env } from "./env";

export let natsClient: Client | undefined = undefined;

export const connectNats = async (): Promise<Client> => {
  if (!natsClient) {
    natsClient = await connect({ servers: [env.nodeUrl] });
  }
  return natsClient;
};

export const closeNats = (): void => {
  if (natsClient) {
    natsClient.close();
  }
  natsClient = undefined;
};
