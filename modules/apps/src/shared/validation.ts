import { AppRegistryInfo } from "./registry";
import { CFCoreTypes, stringify, bigNumberifyObj } from "@connext/types";
import { Zero } from "ethers/constants";
import { bigNumberify, getAddress } from "ethers/utils";
import { CoinBalanceRefundApp } from "..";

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

export const commonAppProposalValidation = (
  params: CFCoreTypes.ProposeInstallParams,
  appRegistryInfo: AppRegistryInfo,
  initiatorFreeBalance: string,
  responderFreeBalance: string,
): void => {
  const {
    initiatorDeposit,
    initiatorDepositTokenAddress,
    responderDeposit,
    responderDepositTokenAddress,
    timeout,
  } = bigNumberifyObj(params);

  appProposalMatchesRegistry(params, appRegistryInfo);

  if (timeout.lt(Zero)) {
    throw new Error(`"timeout" in params cannot be negative`);
  }

  if (initiatorDeposit.lt(Zero) || bigNumberify(responderDeposit).lt(Zero)) {
    throw new Error(`Cannot have negative initiator or responder deposits into applications.`);
  }

  if (responderDepositTokenAddress && !getAddress(responderDepositTokenAddress)) {
    throw new Error(`Invalid "responderDepositTokenAddress" provided`);
  }

  if (initiatorDepositTokenAddress && !getAddress(initiatorDepositTokenAddress)) {
    throw new Error(`Invalid "initiatorDepositTokenAddress" provided`);
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

  const initiatorFreeBalanceBN = bigNumberify(initiatorFreeBalance);
  if (initiatorFreeBalanceBN.lt(initiatorDeposit)) {
    throw new Error(
      `Initiator has insufficient funds to install proposed app. Initiator free balance: ${initiatorFreeBalanceBN.toString()}, deposit requested: ${initiatorDeposit.toString()}`,
    );
  }

  const nodeFreeBalanceBN = bigNumberify(responderFreeBalance);
  if (nodeFreeBalanceBN.lt(responderDeposit)) {
    throw new Error(`Node has insufficient balance to install the app with proposed deposit.`);
  }
};
