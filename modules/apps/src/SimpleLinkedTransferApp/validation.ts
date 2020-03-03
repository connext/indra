import { xkeyKthAddress } from "@connext/cf-core";
import { CFCoreTypes, CoinTransferBigNumber, bigNumberifyObj, stringify } from "@connext/types";

import { SimpleLinkedTransferAppStateBigNumber } from "./types";
import { unidirectionalCoinTransferValidation } from "../shared";

export const validateSimpleLinkedTransferApp = (
  params: CFCoreTypes.ProposeInstallParams,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit, initialState: initialStateBadType } = bigNumberifyObj(
    params,
  );

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

  const initialState = bigNumberifyObj(
    initialStateBadType,
  ) as SimpleLinkedTransferAppStateBigNumber;

  initialState.coinTransfers = initialState.coinTransfers.map((transfer: CoinTransferBigNumber) =>
    bigNumberifyObj(transfer),
  ) as any;

  const initiatorTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === initiatorFreeBalanceAddress;
  })[0];
  const responderTransfer = initialState.coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return transfer.to === responderFreeBalanceAddress;
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
