import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { IConnextClient } from "@connext/types";
import { ColorfulLogger } from "@connext/utils";

export const createClient = async (
  privateKey: string,
  name: string,
  log: ColorfulLogger,
  nodeUrl: string,
  ethProviderUrl: string,
  messagingUrl: string,
  logLevel: number,
): Promise<IConnextClient> => {
  const store = getFileStore(`.connext-store/${privateKey}`);
  const client = await connect({
    ethProviderUrl,
    messagingUrl,
    nodeUrl,
    signer: privateKey,
    loggerService: new ColorfulLogger(name, logLevel, true, name),
    store,
  });

  log.info(`Client ${name}:
      publicIdentifier: ${client.publicIdentifier}
      signer: ${client.signerAddress}
      nodeIdentifier: ${client.nodeIdentifier}
      nodeSignerAddress: ${client.nodeSignerAddress}`);

  return client;
};
