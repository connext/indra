import {
  MethodParams,
  CoinTransfer,
  SimpleLinkedTransferAppState,
  stringify,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";


import { unidirectionalCoinTransferValidation } from "../shared";

export const validateSimpleLinkedTransferApp = (
  params: MethodParams.ProposeInstall,
  initiatorIdentifier: string,
  responderIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as SimpleLinkedTransferAppState;

  const initiatorSignerAddress = getSignerAddressFromPublicIdentifier(initiatorIdentifier);
  const responderSignerAddress = getSignerAddressFromPublicIdentifier(responderIdentifier);

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === initiatorSignerAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransfer) => {
    return transfer.to === responderSignerAddress;
  })[0];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );

  if (!initialState.amount.eq(initiatorDeposit)) {
    throw new Error(`Payment amount bust be the same as initiator deposit ${stringify(params)}`);
  }
};
