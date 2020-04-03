import { xkeyKthAddress } from "@connext/cf-core";
import {
  MethodParams,
  DepositAppState,
  stringify,
  MIN_DEPOSIT_TIMEOOUT_BLOCKS,
} from "@connext/types";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";

import { baseCoinTransferValidation } from "../shared";
import { Zero, AddressZero } from "ethers/constants";
import { Contract } from "ethers";
import { BaseProvider } from "ethers/providers";

export const validateDepositApp = async (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
  multisigAddress: string,
  provider: BaseProvider,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as DepositAppState;

  const initiatorFreeBalanceAddress = xkeyKthAddress(initiatorPublicIdentifier);
  const responderFreeBalanceAddress = xkeyKthAddress(responderPublicIdentifier);

  const initiatorTransfer = initialState.transfers[0];
  const responderTransfer = initialState.transfers[1];

  baseCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );

  if (initiatorFreeBalanceAddress !== initiatorTransfer.to) {
    throw new Error(`Cannot install deposit app with incorrect initiator transfer to address: Expected ${initiatorFreeBalanceAddress}, got ${initiatorTransfer.to}`);
  }

  if (responderFreeBalanceAddress !== responderTransfer.to) {
    throw new Error(`Cannot install deposit app with incorrect responder transfer to address: Expected ${responderFreeBalanceAddress}, got ${responderTransfer.to}`);
  }

  // if (initialState.transfers[0].amount.isZero() || initialState.transfers[1].amount.isZero()) {
  //   throw new Error(`Cannot install deposit app with nonzero initial balance: ${stringify(initialState.transfers)}`);
  // }

  if (initialState.multisigAddress !== multisigAddress) {
    throw new Error(`Cannot install deposit app with invalid multisig address. Expected ${multisigAddress}, got ${initialState.multisigAddress}`);
  }

  if (
    initialState.assetId !== params.initiatorDepositTokenAddress
    || initialState.assetId !== params.responderDepositTokenAddress
  ) {
    throw new Error(`Cannot install deposit app with invalid token address. Expected ${params.initiatorDepositTokenAddress}, got ${initialState.assetId}`);
  }

  const multisig = new Contract(multisigAddress, MinimumViableMultisig.abi, provider);
  let startingTotalAmountWithdrawn;
  try {
    startingTotalAmountWithdrawn = await multisig
      .functions
      .totalAmountWithdrawn(initialState.assetId);
  } catch (e) {
    const NOT_DEPLOYED_ERR = `contract not deployed (contractAddress="${multisigAddress}"`;
    if (!e.message.includes(NOT_DEPLOYED_ERR)) {
      throw new Error(e);
    }
    // multisig is deployed on withdrawal, if not
    // deployed withdrawal amount is 0
    startingTotalAmountWithdrawn = Zero;
  }

  if (initialState.finalized) {
    throw new Error(`Cannot install a deposit app with finalized state`);
  }

  const minTimelock = MIN_DEPOSIT_TIMEOOUT_BLOCKS.add(await provider.getBlockNumber());
  if (
    initialState.timelock.lt(minTimelock)) {
    throw new Error(`Cannot install a deposit app with timelock within ${MIN_DEPOSIT_TIMEOOUT_BLOCKS} of now (${await provider.getBlockNumber()})`);
  }

  const startingMultisigBalance = initialState.assetId === AddressZero
    ? await provider.getBalance(multisigAddress)
    : await new Contract(initialState.assetId, ERC20.abi, provider)
        .functions
        .balanceOf(multisigAddress);

  if (!initialState.startingTotalAmountWithdrawn.eq(startingTotalAmountWithdrawn)) {
    throw new Error(`Cannot install deposit app with invalid totalAmountWithdrawn. Expected ${startingTotalAmountWithdrawn}, got ${initialState.startingTotalAmountWithdrawn}`);
  }

  if (!initialState.startingMultisigBalance.eq(startingMultisigBalance)) {
    throw new Error(`Cannot install deposit app with invalid startingMultisigBalance. Expected ${startingMultisigBalance}, got ${initialState.startingMultisigBalance}`);
  }
};
