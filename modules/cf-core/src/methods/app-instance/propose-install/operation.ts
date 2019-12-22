import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../constants";
import { appIdentityToHash } from "../../../machine";
import { AppInstanceProposal } from "../../../models";
import { Store } from "../../../store";
import { NetworkContext, CFCoreTypes } from "../../../types";
import { NO_NETWORK_PROVIDER_CREATE2 } from "../../errors";

/**
 * Creates a AppInstanceProposal to reflect the proposal received from
 * the client.
 * @param myIdentifier
 * @param store
 * @param params
 */
export async function createProposedAppInstance(
  myIdentifier: string,
  store: Store,
  networkContext: NetworkContext,
  params: CFCoreTypes.ProposeInstallParams
): Promise<string> {
  const {
    abiEncodings,
    appDefinition,
    initialState,
    initiatorDeposit,
    initiatorDepositTokenAddress,
    outcomeType,
    proposedToIdentifier,
    responderDeposit,
    responderDepositTokenAddress,
    timeout
  } = params;

  // no way to determine if this is a virtual or regular app being
  // proposed. because it may be a virtual app, and the function defaults
  // to pulling from the store, assume it is okay to use a generated
  // multisig.

  // if the generated multisig address is wrong (because proxy has been
  // redeployed), then there will be a state channel added to the store
  // under the wrong multisig address, with *no* free balance app instance
  // and this is where the app instance will be stored. the only time this
  // should come up in practice (because it defaults to pulling multisig
  // address from the store) is when it's a virtual app between a *new*
  // initiator and responder pair.
  const multisigAddress = await store.getMultisigAddressWithCounterparty(
    [myIdentifier, proposedToIdentifier],
    networkContext.ProxyFactory,
    networkContext.MinimumViableMultisig,
    networkContext.provider
  );

  const stateChannel = await store.getOrCreateStateChannelBetweenVirtualAppParticipants(
    multisigAddress,
    networkContext.ProxyFactory,
    myIdentifier,
    proposedToIdentifier
  );

  const appInstanceProposal: AppInstanceProposal = {
    identityHash: appIdentityToHash({
      appDefinition,
      channelNonce: stateChannel.numProposedApps,
      participants: stateChannel.getSigningKeysFor(
        stateChannel.numProposedApps
      ),
      defaultTimeout: timeout.toNumber()
    }),
    abiEncodings: abiEncodings,
    appDefinition: appDefinition,
    appSeqNo: stateChannel.numProposedApps,
    initialState: initialState,
    initiatorDeposit: initiatorDeposit.toHexString(),
    initiatorDepositTokenAddress:
      initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    outcomeType: outcomeType,
    proposedByIdentifier: myIdentifier,
    proposedToIdentifier: proposedToIdentifier,
    responderDeposit: responderDeposit.toHexString(),
    responderDepositTokenAddress:
      responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    timeout: timeout.toHexString()
  };

  await store.saveStateChannel(stateChannel.addProposal(appInstanceProposal));

  return appInstanceProposal.identityHash;
}
