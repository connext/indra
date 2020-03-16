import { connect, Client } from "ts-nats";
import { env } from "./env";

export let natsClient: Client | undefined = undefined;

export const connectNats = async (): Promise<Client> => {
  if (!natsClient) {
    // TODO:
    natsClient = await connect({ servers: ["nats://172.17.0.1:4222"] });
  }
  return natsClient;
};

export const closeNats = (): void => {
  if (natsClient) {
    natsClient.close();
  }
  natsClient = undefined;
};
