import { connect, Client } from "ts-nats";
import { env } from "./env";

export const connectNats = async (): Promise<Client> => {
  return await connect({ servers: [env.nodeUrl] });
};
