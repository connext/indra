import { ProtocolRunner } from "../../../machine";
import { Store } from "../../../store";
import { Protocol } from "../../../types";

export async function uninstallAppInstanceFromChannel(
  store: Store,
  protocolRunner: ProtocolRunner,
  initiatorXpub: string,
  responderXpub: string,
  appInstanceId: string,
): Promise<void> {
  const stateChannel = await store.getStateChannelFromAppInstanceID(appInstanceId);

  const appInstance = stateChannel.getAppInstance(appInstanceId);

  await protocolRunner.initiateProtocol(Protocol.Uninstall, {
    initiatorXpub,
    responderXpub,
    multisigAddress: stateChannel.multisigAddress,
    appIdentityHash: appInstance.identityHash,
  });
}
