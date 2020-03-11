import { BaseProvider } from "ethers/providers";

import { ProtocolRunner } from "../../../machine";
import { Store } from "../../../store";
import { Protocol } from "../../../types";

export async function uninstallVirtualAppInstanceFromChannel(
  store: Store,
  protocolRunner: ProtocolRunner,
  provider: BaseProvider,
  initiatorXpub: string,
  responderXpub: string,
  intermediaryXpub: string,
  appInstanceId: string,
): Promise<void> {
  const stateChannel = await store.getChannelFromAppInstanceID(appInstanceId);

  const appInstance = stateChannel.getAppInstance(appInstanceId);

  const currentChannels = await store.getStateChannelsMap();

  await protocolRunner.initiateProtocol(Protocol.UninstallVirtualApp, currentChannels, {
    initiatorXpub,
    responderXpub,
    intermediaryXpub,
    targetOutcome: await appInstance.computeOutcome(appInstance.state, provider),
    targetAppIdentityHash: appInstance.identityHash,
  });
}
