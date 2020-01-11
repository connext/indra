import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";

import { ChannelProvider } from "./channelProvider";
import { env } from "./env";

export const createRemoteClient = async (
  channelProvider: ChannelProvider,
): Promise<IConnextClient> => {
  const clientOpts: ClientOptions = {
    channelProvider,
    ethProviderUrl: env.ethProviderUrl,
    logLevel: env.logLevel,
  };

  const client = await connect(clientOpts);

  await client.isAvailable();

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
