import { xkeyKthAddress } from "@connext/cf-core";
import {
  MethodParams,
  DepositAppState,
  CoinTransfer,
  stringify,
  toBN,
} from "@connext/types";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts"

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

  if (initiatorFreeBalanceAddress != initiatorTransfer.to) {
      throw new Error(`Cannot install deposit app with incorrect initiator transfer to address: Expected ${initiatorFreeBalanceAddress}, got ${initiatorTransfer.to}`)
  }

  if (initialState.transfers[0].amount != Zero || initialState.transfers[1].amount != Zero) {
      throw new Error(`Cannot install deposit app with nonzero initial balance: ${stringify(initialState.transfers)}`)
  }

  if (initialState.multisigAddress != multisigAddress) {
      throw new Error(`Cannot install deposit app with invalid multisig address. Expected ${multisigAddress}, got ${initialState.multisigAddress}`)
  }

  if (initialState.assetId != params.initiatorDepositTokenAddress || initialState.assetId != params.responderDepositTokenAddress) {
      throw new Error(`Cannot install deposit app with invalid token address. Expected ${params.initiatorDepositTokenAddress}, got ${initialState.assetId}`)
  }

  if (initialState.finalized) {
      throw new Error(`Cannot install a deposit app with finalized state`)
  }

  if (initialState.timelock <= toBN(await provider.getBlockNumber())) {
      throw new Error(`Cannot install a deposit app with an expired timeout`)
  }

  const multisig = new Contract(multisigAddress, MinimumViableMultisig.abi, provider)
  const startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(initialState.assetId)
  let startingMultisigBalance;
  
  if(initialState.assetId == AddressZero) {
    startingMultisigBalance = await provider.getBalance(multisigAddress);
  } else {
    const erc20 = new Contract(initialState.assetId, ERC20.abi, provider)
    startingMultisigBalance = await erc20.functions.balanceOf(multisigAddress)
  }

  if (initialState.startingTotalAmountWithdrawn != startingTotalAmountWithdrawn) {
      throw new Error(`Cannot install deposit app with invalid totalAmountWithdrawn. Expected ${startingTotalAmountWithdrawn}, got ${initialState.startingTotalAmountWithdrawn}`)
  }

  if (initialState.startingMultisigBalance != startingMultisigBalance) {
      throw new Error(`Cannot install deposit app with invalid startingMultisigBalance. Expected ${startingMultisigBalance}, got ${initialState.startingMultisigBalance}`)
  }
};
