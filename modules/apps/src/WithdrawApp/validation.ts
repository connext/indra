import { xkeyKthAddress } from "@connext/cf-core";
<<<<<<< HEAD
import { MethodParams, WithdrawAppState } from "@connext/types";
=======
import {
  CFCoreTypes,
  CoinTransferBigNumber,
  bigNumberifyObj,
  WithdrawAppState,
} from "@connext/types";
>>>>>>> nats-messaging-refactor

import { unidirectionalCoinTransferValidation } from "../shared";
import { recoverAddress } from "ethers/utils";
import { HashZero, Zero } from "ethers/constants";

export const validateWithdrawApp = (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as WithdrawAppState;

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

<<<<<<< HEAD
=======
  const initialState: WithdrawAppState<BigNumber> = convertWithrawAppState(
    "bignumber",
    initialStateBadType,
  );

  initialState.transfers = initialState.transfers.map((transfer: CoinTransferBigNumber) =>
    bigNumberifyObj(transfer),
  ) as any;

>>>>>>> nats-messaging-refactor
  const initiatorTransfer = initialState.transfers[0];
  const responderTransfer = initialState.transfers[1];

  unidirectionalCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );

<<<<<<< HEAD
  if(initialState.finalized) {
    throw new Error(
      `Cannot install a withdraw app with a finalized state. State: ${initialState}`,
    );
  }

  if(initialState.signatures[1] !== HashZero) {
=======
  if (initialState.finalized) {
    throw new Error(`Cannot install a withdraw app with a finalized state. State: ${initialState}`);
  }

  if (initialState.signatures[1] !== HashZero) {
>>>>>>> nats-messaging-refactor
    throw new Error(
      `Cannot install a withdraw app with a populated signatures[1] field. Signatures[1]: ${initialState.signatures[1]}`,
    );
  }

<<<<<<< HEAD
  if(
=======
  if (
>>>>>>> nats-messaging-refactor
    initialState.signers[0] !== initiatorFreeBalanceAddress ||
    initialState.signers[1] !== responderFreeBalanceAddress
  ) {
    throw new Error(
      `Cannot install a withdraw app if signers[] do not match multisig participant addresses. Signers[]: ${initialState.signers}`,
    );
  }

<<<<<<< HEAD
  if(!initialState.transfers[1].amount.eq(Zero)) {
=======
  if (!initialState.transfers[1].amount.eq(Zero)) {
>>>>>>> nats-messaging-refactor
    throw new Error(
      `Cannot install a withdraw app with nonzero recipient amount. ${initialState.transfers[1].amount.toString()}`,
    );
  }

  let recovered = recoverAddress(initialState.data, initialState.signatures[0]);

<<<<<<< HEAD
  if(recovered !== initialState.signers[0]) {
    throw new Error(
      `Cannot install withdraw app - incorrect signer recovered from initiator sig on data. 
       Recovered: ${recovered}, Expected: ${initialState.signers[0]}`,
=======
  if (recovered !== initialState.signers[0]) {
    throw new Error(
      `Cannot install withdraw app - incorrect signer recovered from initiator sig on data. 
         Recovered: ${recovered}, Expected: ${initialState.signers[0]}`,
>>>>>>> nats-messaging-refactor
    );
  }
};
