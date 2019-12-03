import { Zero } from "ethers/constants";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConnextClient } from "../connext";
import { Logger, stringify, xpubToAddress } from "../lib";
import {
  CFCoreTypes,
  CoinTransferBigNumber,
  convert,
  DefaultApp,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleSwapAppState,
  SimpleSwapAppStateBigNumber,
  SimpleTransferAppState,
  SimpleTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
} from "../types";

import { invalidAddress } from "./addresses";
import { invalid32ByteHexString } from "./hexStrings";
import { validator } from "./validator";

type ProposalValidator = {
  [index in SupportedApplication]: (
    params: CFCoreTypes.ProposeInstallParams,
    proposedByIdentifier: string,
    registeredInfo: DefaultApp,
    connext: ConnextClient,
  ) => Promise<string | undefined>;
};

export const validateSwapApp = async (
  params: CFCoreTypes.ProposeInstallParams,
  proposedByIdentifier: string,
  registeredInfo: DefaultApp,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(
    params,
    proposedByIdentifier,
    registeredInfo,
    connext,
  );
  if (baseValidation) {
    return baseValidation;
  }

  // validate initial state
  const { coinTransfers } = convert.SwapAppState(
    "bignumber",
    params.initialState as SimpleSwapAppState,
  ) as SimpleSwapAppStateBigNumber;

  if (coinTransfers.length !== 0) {
    return invalidAppMessage(`Incorrect number of coin transfers in initial app state`, params);
  }

  const coinTransferErrs = validateCoinTransfers(coinTransfers[0]);
  if (coinTransferErrs) return invalidAppMessage(coinTransferErrs, params);

  // validate the timeout is above the minimum (?)

  // This is called as a default to the propose app install event
  // which does not have context into what *your* exchange rate is

  return undefined;
};

export const validateSimpleTransferApp = async (
  params: CFCoreTypes.ProposeInstallParams,
  proposedByIdentifier: string,
  registeredInfo: DefaultApp,
  connext: ConnextClient,
  // TODO: ideally this wouldnt get passed in, but you need it
  // to check things like your public identifier, open apps,
  // free balance, etc.
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(
    params,
    proposedByIdentifier,
    registeredInfo,
    connext,
  );
  if (baseValidation) {
    return baseValidation;
  }

  const { responderDeposit, initiatorDeposit, initialState } = params;

  // check that the receivers deposit is 0
  // assume the recipient is always the responder
  if (!responderDeposit.isZero()) {
    return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${stringify(
      params,
    )}`;
  }

  if (initiatorDeposit.isZero()) {
    return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${stringify(
      params,
    )}`;
  }

  // validate initial state
  const { coinTransfers } = convert.SimpleTransferAppState(
    "bignumber",
    initialState as SimpleTransferAppState,
  ) as SimpleTransferAppStateBigNumber;

  const coinTransferErrs = validateCoinTransfers(coinTransfers);
  if (coinTransferErrs) return invalidAppMessage(coinTransferErrs, params);

  return undefined;
};

export const validateLinkedTransferApp = async (
  params: CFCoreTypes.ProposeInstallParams,
  proposedByIdentifier: string,
  registeredInfo: DefaultApp,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(
    params,
    proposedByIdentifier,
    registeredInfo,
    connext,
  );
  if (baseValidation) {
    return baseValidation;
  }

  const { responderDeposit, initialState, initiatorDeposit, initiatorDepositTokenAddress } = params;

  // check that the receivers deposit is 0
  // assume the recipient is always the responder
  if (!responderDeposit.isZero()) {
    return invalidAppMessage(`Responder (payee) must have a zero balance in proposed app`, params);
  }

  if (initiatorDeposit.isZero()) {
    return invalidAppMessage(`Initiator (payor) must have nonzero balance in proposed app`, params);
  }

  // validate initial state
  const {
    coinTransfers,
    amount,
    assetId,
    linkedHash,
    paymentId,
    preImage,
  } = convert.LinkedTransferAppState(
    "bignumber",
    initialState as SimpleLinkedTransferAppState,
  ) as SimpleLinkedTransferAppStateBigNumber;

  // check valid addresses and non-negative coin transfers
  const coinTransferErrs = validateCoinTransfers(coinTransfers);
  if (coinTransferErrs) return invalidAppMessage(coinTransferErrs, params);

  // make sure amount is same as coin transfer amount
  const nonzeroCoinTransfer = coinTransfers.filter((transfer: CoinTransferBigNumber) => {
    return !transfer.amount.isZero();
  });

  if (nonzeroCoinTransfer.length > 1) {
    return invalidAppMessage(
      `Not installing an app with two nonzero coin transfer entries`,
      params,
    );
  }

  if (!nonzeroCoinTransfer[0].amount.eq(initiatorDeposit)) {
    return invalidAppMessage(`Responder deposit does not match amount in coin transfers`, params);
  }

  if (!amount.eq(initiatorDeposit)) {
    return invalidAppMessage(`Responder deposit does not match amount in initial state`, params);
  }

  // make sure assetId is the same as initiator token address
  if (assetId !== initiatorDepositTokenAddress) {
    return invalidAppMessage(
      `Initiator deposit token address does not match the assetId of the initial state`,
      params,
    );
  }

  // make sure hash, paymentId, and preimage are 32 byte hex strings
  if (
    invalid32ByteHexString(paymentId) ||
    invalid32ByteHexString(preImage) ||
    invalid32ByteHexString(linkedHash)
  ) {
    return invalidAppMessage(
      `Invalid 32 byte hex string detected in paymentId, preImage, or linkedHash`,
      params,
    );
  }

  return undefined;
};

const baseAppValidation = async (
  params: CFCoreTypes.ProposeInstallParams,
  proposedByIdentifier: string,
  registeredInfo: DefaultApp,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const log = new Logger("baseAppValidation", connext.log.logLevel);
  // check the initial state is consistent
  log.info(`Validating app: ${stringify(params)}`);
  // check that the app definition is the same
  if (params.appDefinition !== registeredInfo.appDefinitionAddress) {
    return invalidAppMessage(`Incorrect app definition detected`, params);
  }

  // check that the encoding is the same
  // FIXME: stupid hacky thing for null vs undefined
  params.abiEncodings.actionEncoding = params.abiEncodings.actionEncoding
    ? params.abiEncodings.actionEncoding
    : null;
  registeredInfo.actionEncoding = registeredInfo.actionEncoding
    ? registeredInfo.actionEncoding
    : null;
  if (params.abiEncodings.actionEncoding !== registeredInfo.actionEncoding) {
    return invalidAppMessage(`Incorrect action encoding detected`, params);
  }

  if (params.abiEncodings.stateEncoding !== registeredInfo.stateEncoding) {
    return invalidAppMessage(`Incorrect state encoding detected`, params);
  }

  // neither deposit should be negative
  if (bigNumberify(params.initiatorDeposit).lt(0) || bigNumberify(params.responderDeposit).lt(0)) {
    return invalidAppMessage(`Refusing to install app with negative deposits`, params);
  }

  // neither token address should be invalid
  if (
    invalidAddress(params.initiatorDepositTokenAddress) ||
    invalidAddress(params.responderDepositTokenAddress)
  ) {
    return invalidAppMessage(`Refusing to install app with negative deposits`, params);
  }

  // make sure there are no two person 0 value deposits for all but the
  // coinbalance refund app
  const isRefund =
    params.appDefinition === connext.config.contractAddresses["CoinBalanceRefundApp"];
  if (
    !isRefund &&
    bigNumberify(params.initiatorDeposit).isZero() &&
    bigNumberify(params.responderDeposit).isZero()
  ) {
    return invalidAppMessage(`Refusing to install app with two zero value deposits`, params);
  }

  // make sure that the app is allowed to be installed by the node
  if (proposedByIdentifier === connext.nodePublicIdentifier && !registeredInfo.allowNodeInstall) {
    return invalidAppMessage(`Node is not allowed to install this app`, params);
  }

  // check that there is enough in the free balance of desired currency
  // to install apps
  const responderAssetBalance = await connext.getFreeBalance(
    getAddress(params.responderDepositTokenAddress),
  );
  const userFreeBalance = responderAssetBalance[xpubToAddress(connext.publicIdentifier)];
  if (userFreeBalance.lt(params.responderDeposit)) {
    return invalidAppMessage(
      `Insufficient free balance for requested asset,
      freeBalance: ${userFreeBalance.toString()}
      required: ${params.responderDeposit}`,
      params,
    );
  }

  // check that the intermediary has sufficient collateral in your
  // channel
  const initiatorAssetBalance = await connext.getFreeBalance(
    getAddress(params.initiatorDepositTokenAddress),
  );
  const nodeFreeBalance = initiatorAssetBalance[xpubToAddress(connext.nodePublicIdentifier)];
  if (nodeFreeBalance.lt(params.initiatorDeposit)) {
    return invalidAppMessage(
      `Insufficient free balance for requested asset,
      freeBalance: ${nodeFreeBalance.toString()}
      required: ${params.initiatorDeposit}`,
      params,
    );
  }

  return undefined;
};

const invalidAppMessage = (prefix: string, params: CFCoreTypes.ProposeInstallParams): string => {
  return `${prefix}. Proposed app: ${stringify(params)}`;
};

const validateCoinTransfers = (coinTransfers: CoinTransferBigNumber[]): string => {
  const errs = validator(
    coinTransfers.map((coinTransfer: CoinTransferBigNumber) => {
      if (coinTransfer.amount.lt(Zero)) {
        return `Will not install swap app with negative coin transfer amounts`;
      }

      if (invalidAddress(coinTransfer.to)) {
        return `Will not install app with invalid coin transfer addresses`;
      }

      return undefined;
    }),
  );

  if (errs.length > 0) {
    // all error messages will be the same, only return first
    return errs.toString();
  }

  return undefined;
};

export const appProposalValidation: ProposalValidator = {
  CoinBalanceRefundApp: baseAppValidation,
  SimpleLinkedTransferApp: validateLinkedTransferApp,
  SimpleTransferApp: validateSimpleTransferApp,
  SimpleTwoPartySwapApp: validateSwapApp,
};
