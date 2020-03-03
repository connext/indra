import { xkeyKthAddress } from "@connext/cf-core";
import { CFCoreTypes, stringify, bigNumberifyObj, CoinTransferBigNumber } from "@connext/types";

import { CoinBalanceRefundApp } from "..";

import { AppRegistryInfo } from "./registry";
import { BigNumber } from "ethers/utils";
import { Zero } from "ethers/constants";

const appProposalMatchesRegistry = (
  proposal: CFCoreTypes.ProposeInstallParams,
  appRegistryInfo: AppRegistryInfo,
): void => {
  if (
    !(
      // proposal.appDefinition === appRegistryInfo.appDefinitionAddress &&
      (
        proposal.abiEncodings.actionEncoding === appRegistryInfo.actionEncoding &&
        proposal.abiEncodings.stateEncoding === appRegistryInfo.stateEncoding
      )
    )
  ) {
    throw new Error(
      `Proposed app details ${stringify(proposal)} do not match registry ${stringify(
        appRegistryInfo,
      )}`,
    );
  }
};

/**
 * Validation for apps that have "coinTransfers" in the state. Coin transfers are in-app balances
 * that are able to be modified using app logic and resolve back into free balance when the app
 * is uninstalled.
 *
 * @param params
 * @param initiatorPublicIdentifier
 * @param responderPublicIdentifier
 */
export const baseCoinTransferValidation = (
  initiatorDeposit: BigNumber,
  responderDeposit: BigNumber,
  initiatorTransfer: CoinTransferBigNumber,
  responderTransfer: CoinTransferBigNumber,
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
 * @param initiatorPublicIdentifier
 * @param responderPublicIdentifier
 */
export const unidirectionalCoinTransferValidation = (
  initiatorDeposit: BigNumber,
  responderDeposit: BigNumber,
  initiatorTransfer: CoinTransferBigNumber,
  responderTransfer: CoinTransferBigNumber,
) => {
  baseCoinTransferValidation(
    initiatorDeposit,
    responderDeposit,
    initiatorTransfer,
    responderTransfer,
  );
  if (!responderDeposit.eq(Zero)) {
    throw new Error(
      `Will not accept transfer install where responder deposit is != 0 ${responderDeposit.toString()}`,
    );
  }

  if (initiatorDeposit.lte(Zero)) {
    throw new Error(
      `Will not accept transfer install where initiator deposit is <=0 ${initiatorDeposit.toString()}`,
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
  params: CFCoreTypes.ProposeInstallParams,
  appRegistryInfo: AppRegistryInfo,
  supportedTokenAddresses: string[],
): void => {
  const {
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress,
  } = bigNumberifyObj(params);

  appProposalMatchesRegistry(params, appRegistryInfo);

  if (!supportedTokenAddresses.includes(initiatorDepositTokenAddress)) {
    throw new Error(`Unsupported "initiatorDepositTokenAddress" provided`);
  }

  if (!supportedTokenAddresses.includes(responderDepositTokenAddress)) {
    throw new Error(`Unsupported "responderDepositTokenAddress" provided`);
  }

  // NOTE: may need to remove this condition if we start working
  // with games
  if (
    responderDeposit.isZero() &&
    initiatorDeposit.isZero() &&
    appRegistryInfo.name !== CoinBalanceRefundApp
  ) {
    throw new Error(
      `Cannot install an app with zero valued deposits for both initiator and responder.`,
    );
  }
};
