import { CoinTransfer, SimpleLinkedTransferAppState, ProtocolParams } from "@connext/types";
import { getSignerAddressFromPublicIdentifier } from "@connext/utils";

import { unidirectionalCoinTransferValidation } from "../shared";

export const validateSimpleLinkedTransferApp = (params: ProtocolParams.Propose) => {
  const { responderDeposit, initiatorDeposit, initiatorIdentifier, responderIdentifier } = params;
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
};
