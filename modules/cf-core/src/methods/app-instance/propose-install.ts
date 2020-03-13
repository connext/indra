import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { jsonRpcMethod } from "rpc-server";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import {
  INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET,
  NULL_INITIAL_STATE_FOR_PROPOSAL,
} from "../../errors";
import { AppInstanceProposal, StateChannel } from "../../models";
import { RequestHandler } from "../../request-handler";
import { Store } from "../../store";
import {
  MethodNames,
  MethodParams,
  MethodResult,
  NetworkContext,
  ProposeInstallParams,
  ProposeInstallResult,
  Protocol,
} from "../../types";
import { appIdentityToHash } from "../../utils";
import { xkeyKthAddress } from "../../xkeys";

import { NodeController } from "../controller";

/**
 * This creates an entry of a proposed AppInstance while sending the proposal
 * to the peer with whom this AppInstance is specified to be installed.
 *
 * @returns The AppInstanceId for the proposed AppInstance
 */
export class ProposeInstallAppInstanceController extends NodeController {
  @jsonRpcMethod(MethodNames.chan_proposeInstall)
  public executeMethod: (
    requestHandler: RequestHandler,
    params: MethodParams,
  ) => Promise<MethodResult> = super.executeMethod;

  protected async getRequiredLockNames(
    requestHandler: RequestHandler,
    params: ProposeInstallParams,
  ): Promise<string[]> {
    const { networkContext, publicIdentifier, store } = requestHandler;
    const { proposedToIdentifier } = params;

    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    return [multisigAddress];
  }

  protected async beforeExecution(
    requestHandler: RequestHandler,
    params: ProposeInstallParams,
  ): Promise<void> {
    const { networkContext, publicIdentifier, store } = requestHandler;
    const { initialState } = params;

    if (!initialState) {
      throw Error(NULL_INITIAL_STATE_FOR_PROPOSAL);
    }

    const {
      proposedToIdentifier,
      initiatorDepositTokenAddress: initiatorDepositTokenAddressParam,
      responderDepositTokenAddress: responderDepositTokenAddressParam,
    } = params;

    const myIdentifier = publicIdentifier;

    // see comment in `getRequiredLockNames`
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    const initiatorDepositTokenAddress =
      initiatorDepositTokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const responderDepositTokenAddress =
      responderDepositTokenAddressParam || CONVENTION_FOR_ETH_TOKEN_ADDRESS;

    const stateChannel = await store.getOrCreateStateChannelBetweenVirtualAppParticipants(
      multisigAddress,
      {
        proxyFactory: networkContext.ProxyFactory,
        multisigMastercopy: networkContext.MinimumViableMultisig,
      },
      myIdentifier,
      proposedToIdentifier,
    );

    params.initiatorDepositTokenAddress = initiatorDepositTokenAddress;
    params.responderDepositTokenAddress = responderDepositTokenAddress;
  }

  protected async executeMethodImplementation(
    requestHandler: RequestHandler,
    params: ProposeInstallParams,
  ): Promise<ProposeInstallResult> {
    const { networkContext, protocolRunner, publicIdentifier, store } = requestHandler;

    const { proposedToIdentifier } = params;

    // see comment in `getRequiredLockNames`
    const multisigAddress = await store.getMultisigAddressWithCounterparty(
      [publicIdentifier, proposedToIdentifier],
      networkContext.ProxyFactory,
      networkContext.MinimumViableMultisig,
      networkContext.provider,
    );

    await protocolRunner.initiateProtocol(Protocol.Propose, {
      ...params,
      multisigAddress,
      initiatorXpub: publicIdentifier,
      responderXpub: proposedToIdentifier,
    });

    return {
      appInstanceId: (
        await store.getStateChannel(multisigAddress)
      ).mostRecentlyProposedAppInstance().identityHash,
    };
  }
}

function assertSufficientFundsWithinFreeBalance(
  channel: StateChannel,
  publicIdentifier: string,
  tokenAddress: string,
  depositAmount: BigNumber,
): void {
  if (!channel.hasFreeBalance) return;

  const freeBalanceForToken =
    channel.getFreeBalanceClass().getBalance(tokenAddress, xkeyKthAddress(publicIdentifier, 0)) ||
    Zero;

  if (freeBalanceForToken.lt(depositAmount)) {
    throw Error(
      INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET(
        publicIdentifier,
        channel.multisigAddress,
        tokenAddress,
        freeBalanceForToken,
        depositAmount,
      ),
    );
  }
}

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
  params: ProposeInstallParams,
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
    timeout,
  } = params;

  const multisigAddress = await store.getMultisigAddressWithCounterparty(
    [myIdentifier, proposedToIdentifier],
    networkContext.ProxyFactory,
    networkContext.MinimumViableMultisig,
    networkContext.provider,
  );

  const stateChannel = await store.getOrCreateStateChannelBetweenVirtualAppParticipants(
    multisigAddress,
    {
      proxyFactory: networkContext.ProxyFactory,
      multisigMastercopy: networkContext.MinimumViableMultisig,
    },
    myIdentifier,
    proposedToIdentifier,
  );

  const appInstanceProposal: AppInstanceProposal = {
    identityHash: appIdentityToHash({
      appDefinition,
      channelNonce: stateChannel.numProposedApps,
      participants: stateChannel.getSigningKeysFor(stateChannel.numProposedApps),
      defaultTimeout: timeout.toNumber(),
    }),
    abiEncodings: abiEncodings,
    appDefinition: appDefinition,
    appSeqNo: stateChannel.numProposedApps,
    initialState: initialState,
    initiatorDeposit: initiatorDeposit.toHexString(),
    initiatorDepositTokenAddress: initiatorDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    outcomeType: outcomeType,
    proposedByIdentifier: myIdentifier,
    proposedToIdentifier: proposedToIdentifier,
    responderDeposit: responderDeposit.toHexString(),
    responderDepositTokenAddress: responderDepositTokenAddress || CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    timeout: timeout.toHexString(),
  };

  await store.saveStateChannel(stateChannel.addProposal(appInstanceProposal));

  return appInstanceProposal.identityHash;
}
