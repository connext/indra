import { CoinTransfer, DepositAppName, ProtocolParams } from "@connext/types";
import { getAddressFromAssetId, stringify } from "@connext/utils";
import { BigNumber, constants } from "ethers";

import { AppRegistryInfo, DEFAULT_APP_TIMEOUT, MINIMUM_APP_TIMEOUT } from "./registry";

const { Zero } = constants;

const appProposalMatchesRegistry = (
  proposal: ProtocolParams.Propose,
  appRegistryInfo: AppRegistryInfo,
): void => {
  if (
    proposal.abiEncodings.actionEncoding &&
    proposal.abiEncodings.actionEncoding !== appRegistryInfo.actionEncoding
  ) {
    throw new Error(
      `Proposal action encoding does not match registry. Proposal: ${stringify(
        proposal,
      )}, registry ${stringify(appRegistryInfo)}`,
    );
  }
  if (proposal.abiEncodings.stateEncoding !== appRegistryInfo.stateEncoding) {
    throw new Error(
      `Proposal state encoding does not match registry. Proposal: ${stringify(
        proposal,
      )}, registry ${stringify(appRegistryInfo)}`,
    );
  }
};

/**
 * Validation for apps that have "coinTransfers" in the state. Coin transfers are in-app balances
 * that are able to be modified using app logic and resolve back into free balance when the app
 * is uninstalled.
 *
 * @param params
 * @param initiatorIdentifier
 * @param responderIdentifier
 */
export const baseCoinTransferValidation = (
  initiatorDeposit: BigNumber,
  responderDeposit: BigNumber,
  initiatorTransfer: CoinTransfer,
  responderTransfer: CoinTransfer,
) => {
  if (!initiatorTransfer || !responderTransfer) {
    throw new Error(
      `Transfers do not match participants, initiatorTransfer: ${JSON.stringify(
        initiatorTransfer,
      )}, responderTransfer: ${JSON.stringify(responderTransfer)}`,
    );
  }

  if (
    !initiatorTransfer.amount.eq(initiatorDeposit) ||
    !responderTransfer.amount.eq(responderDeposit)
  ) {
    throw new Error(`Mismatch between deposits and initial state, refusing to install.`);
  }
};

/**
 * Validation for app assuming initiator is a unidirectional transfer sender and responder
 * is a unidirectional receiver.
 *
 * @param params
 * @param initiatorIdentifier
 * @param responderIdentifier
 */
export const unidirectionalCoinTransferValidation = (
  initiatorDeposit: BigNumber,
  responderDeposit: BigNumber,
  initiatorTransfer: CoinTransfer,
  responderTransfer: CoinTransfer,
) => {
  baseCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
  if (!responderDeposit.eq(Zero)) {
    throw new Error(
      `Will not accept transfer install where responder deposit is != 0. Responder deposit: ${responderDeposit.toString()}`,
    );
  }

  if (initiatorDeposit.lte(Zero)) {
    throw new Error(
      `Will not accept transfer install where initiator deposit is <= 0. Initiator deposit: ${initiatorDeposit.toString()}`,
    );
  }

  if (initiatorTransfer.amount.lte(Zero)) {
    throw new Error(
      `Cannot install a linked transfer app with a sender transfer of <= 0. Transfer amount: ${initiatorTransfer.amount.toString()}`,
    );
  }

  if (!responderTransfer.amount.eq(Zero)) {
    throw new Error(
      `Cannot install a linked transfer app with a redeemer transfer of != 0. Transfer amount: ${responderTransfer.amount.toString()}`,
    );
  }
};

export const commonAppProposalValidation = (
  params: ProtocolParams.Propose,
  appRegistryInfo: AppRegistryInfo,
  supportedTokenAddresses: string[],
): void => {
  const {
    initiatorDeposit,
    initiatorDepositAssetId,
    responderDeposit,
    responderDepositAssetId,
  } = params;

  appProposalMatchesRegistry(params, appRegistryInfo);

  const initiatorDepositTokenAddress = getAddressFromAssetId(initiatorDepositAssetId);
  const responderDepositTokenAddress = getAddressFromAssetId(responderDepositAssetId);

  if (!supportedTokenAddresses.includes(initiatorDepositTokenAddress)) {
    throw new Error(
      `Unsupported initiatorDepositTokenAddress: ${initiatorDepositTokenAddress}, supported addresses: ${stringify(
        supportedTokenAddresses,
      )}`,
    );
  }

  if (!supportedTokenAddresses.includes(responderDepositTokenAddress)) {
    throw new Error(
      `Unsupported responderDepositAssetId: ${responderDepositTokenAddress}, supported addresses: ${stringify(
        supportedTokenAddresses,
      )}`,
    );
  }

  // Validate that the timeouts make sense
  if (params.defaultTimeout.lt(MINIMUM_APP_TIMEOUT)) {
    throw new Error(
      `Cannot install an app with default timeout: ${params.defaultTimeout}, less than minimum timeout: ${MINIMUM_APP_TIMEOUT})`,
    );
  }

  if (params.defaultTimeout.gt(DEFAULT_APP_TIMEOUT)) {
    throw new Error(
      `Cannot install an app with default timeout: ${params.defaultTimeout}, greater than max timeout: ${DEFAULT_APP_TIMEOUT}`,
    );
  }

  // NOTE: may need to remove this condition if we start working
  // with games
  const isDeposit = appRegistryInfo.name === DepositAppName;
  if (responderDeposit.isZero() && initiatorDeposit.isZero() && !isDeposit) {
    throw new Error(
      `Cannot install an app with zero valued deposits for both initiator and responder.`,
    );
  }
};
