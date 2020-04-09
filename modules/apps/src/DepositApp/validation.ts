import {
  MethodParams,
  DepositAppState,
  stringify,
  UninstallMiddlewareContext,
  ProtocolRoles,
  getTokenAddressFromAssetId,
  getAddressFromIdentifier,
} from "@connext/types";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";

import { baseCoinTransferValidation } from "../shared";
import { Zero, AddressZero } from "ethers/constants";
import { Contract } from "ethers";
import { BaseProvider, JsonRpcProvider } from "ethers/providers";

export const validateDepositApp = async (
  params: MethodParams.ProposeInstall,
  initiatorPublicIdentifier: string,
  responderPublicIdentifier: string,
  multisigAddress: string,
  provider: BaseProvider,
) => {
  const { responderDeposit, initiatorDeposit } = params;
  const initialState = params.initialState as DepositAppState;

  const initiatorSignerAddress = getAddressFromIdentifier(initiatorPublicIdentifier);
  const responderSignerAddress = getAddressFromIdentifier(responderPublicIdentifier);

  const initiatorTransfer = initialState.transfers[0];
  const responderTransfer = initialState.transfers[1];

  baseCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );

  if (initiatorSignerAddress !== initiatorTransfer.to) {
    throw new Error(`Cannot install deposit app with incorrect initiator transfer to address: Expected ${initiatorSignerAddress}, got ${initiatorTransfer.to}`);
  }

  if (responderSignerAddress !== responderTransfer.to) {
    throw new Error(`Cannot install deposit app with incorrect responder transfer to address: Expected ${responderSignerAddress}, got ${responderTransfer.to}`);
  }

  if (!initialState.transfers[0].amount.isZero() || !initialState.transfers[1].amount.isZero()) {
      throw new Error(`Cannot install deposit app with nonzero initial balance: ${stringify(initialState.transfers)}`);
  }

  if (initialState.multisigAddress !== multisigAddress) {
    throw new Error(`Cannot install deposit app with invalid multisig address. Expected ${multisigAddress}, got ${initialState.multisigAddress}`);
  }

  if (
    initialState.assetId !== getTokenAddressFromAssetId(params.initiatorDepositAssetId)
    || initialState.assetId !== getTokenAddressFromAssetId(params.responderDepositAssetId)
  ) {
    throw new Error(`Cannot install deposit app with invalid token address. Expected ${getTokenAddressFromAssetId(params.initiatorDepositAssetId)}, got ${initialState.assetId}`);
  }

  const startingMultisigBalance = initialState.assetId === AddressZero
    ? await provider.getBalance(multisigAddress)
    : await new Contract(initialState.assetId, ERC20.abi, provider)
        .functions
        .balanceOf(multisigAddress);

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

  if (!initialState.startingTotalAmountWithdrawn.eq(startingTotalAmountWithdrawn)) {
    throw new Error(`Cannot install deposit app with invalid totalAmountWithdrawn. Expected ${startingTotalAmountWithdrawn}, got ${initialState.startingTotalAmountWithdrawn}`);
  }

  if (!initialState.startingMultisigBalance.eq(startingMultisigBalance)) {
    throw new Error(`Cannot install deposit app with invalid startingMultisigBalance. Expected ${startingMultisigBalance}, got ${initialState.startingMultisigBalance}`);
  }
};

export const uninstallDepositMiddleware = async (
  context: UninstallMiddlewareContext,
  provider: JsonRpcProvider,
) => {
  const {
    role,
    appInstance,
    stateChannel,
    params,
  } = context;

  const latestState = appInstance.latestState as DepositAppState;
  const currentMultisigBalance = latestState.assetId === AddressZero
    ? await provider.getBalance(stateChannel.multisigAddress)
    : await new Contract(latestState.assetId, ERC20.abi as any, provider)
        .functions
        .balanceOf(stateChannel.multisigAddress);

  if (currentMultisigBalance.lt(latestState.startingMultisigBalance)) {
    throw new Error(`Refusing to uninstall, current multisig balance (${currentMultisigBalance.toString()}) is less than starting multsig balance (${latestState.startingMultisigBalance.toString()})`);
  }

  if (
    role === ProtocolRoles.initiator
    && latestState.transfers[0].to !== getAddressFromIdentifier(params.initiatorIdentifier)
  ) {
    throw new Error(`Cannot uninstall deposit app without being the initiator`);
  }

  // TODO: withdrawal amount validation?
};
