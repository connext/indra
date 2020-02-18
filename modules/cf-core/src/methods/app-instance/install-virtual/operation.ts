import { bigNumberify } from "ethers/utils";

import { Protocol, ProtocolRunner } from "../../../machine";
import { Store } from "../../../store";
import { AppInstanceProposal, CFCoreTypes } from "../../../types";
import { NO_APP_INSTANCE_ID_TO_INSTALL, VIRTUAL_APP_INSTALLATION_FAIL } from "../../errors";

export async function installVirtual(
  store: Store,
  protocolRunner: ProtocolRunner,
  params: CFCoreTypes.InstallVirtualParams,
): Promise<AppInstanceProposal> {
  const { appInstanceId, intermediaryIdentifier } = params;

  if (!appInstanceId || !appInstanceId.trim()) {
    throw Error(NO_APP_INSTANCE_ID_TO_INSTALL);
  }

  const proposal = await store.getAppInstanceProposal(appInstanceId);

  const {
    abiEncodings,
    appDefinition,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    outcomeType,
    proposedByIdentifier,
    proposedToIdentifier,
    responderDeposit,
    responderDepositTokenAddress,
    timeout,
  } = proposal;

  if (initiatorDepositTokenAddress !== responderDepositTokenAddress) {
    throw Error("Cannot install virtual app with different token addresses");
  }

  try {
    await protocolRunner.initiateProtocol(
      Protocol.InstallVirtualApp,
      await store.getStateChannelsMap(),
      {
        appInterface: { addr: appDefinition, ...abiEncodings },
        appSeqNo: proposal.appSeqNo,
        defaultTimeout: bigNumberify(timeout).toNumber(),
        initialState,
        initiatorBalanceDecrement: bigNumberify(initiatorDeposit),
        initiatorXpub: proposedToIdentifier,
        intermediaryXpub: intermediaryIdentifier,
        outcomeType,
        responderBalanceDecrement: bigNumberify(responderDeposit),
        responderXpub: proposedByIdentifier,
        tokenAddress: initiatorDepositTokenAddress,
      },
    );
  } catch (e) {
    // TODO: We should generalize this error handling style everywhere
    throw Error(`Node Error: ${VIRTUAL_APP_INSTALLATION_FAIL}\nStack Trace: ${e.stack}`);
  }

  await store.saveStateChannel(
    (await store.getChannelFromAppInstanceID(appInstanceId)).removeProposal(appInstanceId),
  );

  return proposal;
}
