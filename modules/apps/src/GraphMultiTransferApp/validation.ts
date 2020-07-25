import { ProtocolParams, GraphMultiTransferAppState, CoinTransfer } from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";

import { unidirectionalCoinTransferValidation } from "../shared";
import { BigNumber, constants } from "ethers";

const { Zero, AddressZero, HashZero } = constants;

export const validateGraphMultiTransferApp = (params: ProtocolParams.Propose) => {
  const { responderDeposit, initiatorDeposit, initiatorIdentifier, responderIdentifier } = params;
  const initialState = params.initialState as GraphMultiTransferAppState;

  const initiatorSignerAddress = getSignerAddressFromPublicIdentifier(initiatorIdentifier);
  const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorSignerAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderSignerAddress;
  })[0];

  if (!BigNumber.from(initialState.turnNum).eq(Zero)) {
    throw new Error(`Cannot install an app with nonzero turn number: ${initialState.turnNum}`);
  }

  if (initialState.signerAddress === AddressZero || initialState.verifyingContract === AddressZero || initialState.subgraphDeploymentID === HashZero || BigNumber.from(initialState.chainId).eq(Zero)) {
    throw new Error(`Cannot install an app with undefined sig validation details. Initial state: ${stringify(initialState)}`);
  }

  if (initialState.lockedPayment.requestCID !== HashZero || !initialState.lockedPayment.price.eq(Zero)) {
    throw new Error(`Cannot install an app with populated locked payment details. Locked payment: ${stringify(initialState.lockedPayment)}`);
  }

  if (initialState.finalized) {
    throw new Error(`Cannot install an app with finalized state. Finalized: ${initialState.finalized}`)
  }

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
};
