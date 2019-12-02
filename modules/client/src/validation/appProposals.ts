import { CFCoreTypes, OutcomeType } from "@connext/types";
import { bigNumberify, getAddress } from "ethers/utils";

import { ConnextClient } from "../connext";
import { Logger } from "../lib/logger";
import { stringify, xpubToAddress } from "../lib/utils";
import { AppInstanceInfo, AppInstanceJson, DefaultApp, SupportedApplication } from "../types";

type ProposalValidator = {
  [index in SupportedApplication]: (
    app: AppInstanceInfo,
    registeredInfo: DefaultApp,
    isVirtual: boolean,
    connext: ConnextClient,
  ) => Promise<string | undefined>;
};

export const validateSwapApp = async (
  app: AppInstanceInfo,
  registeredInfo: DefaultApp,
  isVirtual: boolean,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // validate the timeout is above the minimum (?)

  // This is called as a default to the propose app install event
  // which does not have context into what *your* exchange rate is

  return undefined;
};

export const validateTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: DefaultApp,
  isVirtual: boolean,
  connext: ConnextClient,
  // TODO: ideally this wouldnt get passed in, but you need it
  // to check things like your public identifier, open apps,
  // free balance, etc.
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // check that the receivers deposit is 0
  // assume the recipient is always the responder
  if (!app.responderDeposit.isZero()) {
    return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${stringify(
      app,
    )}`;
  }

  if (app.initiatorDeposit.isZero()) {
    return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${stringify(
      app,
    )}`;
  }

  return undefined;
};

export const validateSimpleTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: DefaultApp,
  isVirtual: boolean,
  connext: ConnextClient,
  // TODO: ideally this wouldnt get passed in, but you need it
  // to check things like your public identifier, open apps,
  // free balance, etc.
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // check that the receivers deposit is 0
  // assume the recipient is always the responder
  if (!app.responderDeposit.isZero()) {
    return `Responder (payee) must have a zero balance in proposed app. Proposed app: ${stringify(
      app,
    )}`;
  }

  if (app.initiatorDeposit.isZero()) {
    return `Initiator (payor) must have nonzero balance in proposed app. Proposed app: ${stringify(
      app,
    )}`;
  }

  return undefined;
};

export const validateLinkedTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: DefaultApp,
  isVirtual: boolean,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, isVirtual, connext);
  if (baseValidation) {
    return baseValidation;
  }

  return undefined;
};

export const appProposalValidation: ProposalValidator = {
  SimpleLinkedTransferApp: validateLinkedTransferApp,
  SimpleTransferApp: validateSimpleTransferApp,
  SimpleTwoPartySwapApp: validateSwapApp,
};

const baseAppValidation = async (
  app: AppInstanceInfo,
  registeredInfo: DefaultApp,
  isVirtual: boolean,
  connext: ConnextClient,
): Promise<string | undefined> => {
  const log = new Logger("baseAppValidation", connext.log.logLevel);
  // check the initial state is consistent
  log.info(`Validating app: ${stringify(app)}`);
  // check that identity hash isnt used by another app
  const apps = await connext.getAppInstances();
  if (apps) {
    const sharedIds = (await connext.getAppInstances()).filter(
      (a: AppInstanceJson): boolean => a.identityHash === app.identityHash,
    );
    if (sharedIds.length !== 0) {
      return invalidAppMessage(`Duplicate app id detected`, app);
    }
  }

  // check that the app definition is the same
  if (app.appDefinition !== registeredInfo.appDefinitionAddress) {
    return invalidAppMessage(`Incorrect app definition detected`, app);
  }

  // check that the encoding is the same
  if (app.abiEncodings.actionEncoding !== registeredInfo.actionEncoding) {
    return invalidAppMessage(`Incorrect action encoding detected`, app);
  }

  if (app.abiEncodings.stateEncoding !== registeredInfo.stateEncoding) {
    return invalidAppMessage(`Incorrect state encoding detected`, app);
  }

  // check that the outcome type is the same
  const outcomeTypeMsg = invalidAppMessage(
    `No interpreter params provided for ${registeredInfo.outcomeType}`,
    app,
  );
  switch (registeredInfo.outcomeType) {
    case OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER:
      if (!app.multiAssetMultiPartyCoinTransferInterpreterParams) {
        return outcomeTypeMsg;
      }
      break;
    case OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER:
      if (!app.singleAssetTwoPartyCoinTransferInterpreterParams) {
        return outcomeTypeMsg;
      }
      break;
    case OutcomeType.TWO_PARTY_FIXED_OUTCOME:
      if (!app.twoPartyOutcomeInterpreterParams) {
        return outcomeTypeMsg;
      }
      break;
    default:
      return invalidAppMessage(`Unrecognized outcome type`, app);
  }

  // make sure there are no two person 0 value deposits for all but the
  // coinbalance refund app
  const isRefund = app.appDefinition === connext.config.contractAddresses["CoinBalanceRefundApp"];
  if (
    !isRefund &&
    bigNumberify(app.initiatorDeposit).isZero() &&
    bigNumberify(app.responderDeposit).isZero()
  ) {
    return invalidAppMessage(`Refusing to install app with two zero value deposits`, app);
  }

  // make sure that the app is allowed to be installed by the node
  if (
    app.proposedByIdentifier === connext.nodePublicIdentifier &&
    !registeredInfo.allowNodeInstall
  ) {
    return invalidAppMessage(`Node is not allowed to install this app`, app);
  }

  // check that there is enough in the free balance of desired currency
  // to install app
  const responderFreeBalance = await connext.getFreeBalance(
    getAddress(app.responderDepositTokenAddress),
  );
  const userFreeBalance = responderFreeBalance[xpubToAddress(connext.publicIdentifier)];
  if (userFreeBalance.lt(app.responderDeposit)) {
    return invalidAppMessage(
      `Insufficient free balance for requested asset,
      freeBalance: ${userFreeBalance.toString()}
      required: ${app.responderDeposit}`,
      app,
    );
  }

  // check that ledger apps have no intermediary
  if (!isVirtual && app.intermediaryIdentifier) {
    return invalidAppMessage(`Direct apps with node should not have intermediary`, app);
  }

  if (!isVirtual) {
    return undefined;
  }

  // if it is a virtual app, check that the intermediary has sufficient
  // collateral in your channel
  const freeBalance = await connext.getFreeBalance(getAddress(app.initiatorDepositTokenAddress));

  const virtualErrs = validateVirtualAppInfo(app, connext.nodePublicIdentifier, freeBalance);
  if (virtualErrs) return virtualErrs;

  return undefined;
};

function validateVirtualAppInfo(
  app: AppInstanceInfo,
  nodeIdentifier: string,
  freeBalance: CFCoreTypes.GetFreeBalanceStateResult,
): string | undefined {
  // check that the intermediary includes your node if it is not an app with your node
  if (!app.intermediaryIdentifier) {
    return invalidAppMessage(`Virtual apps should have intermediaries`, app);
  }

  const nodeFreeBalance = freeBalance[xpubToAddress(nodeIdentifier)];
  if (nodeFreeBalance.lt(app.initiatorDeposit)) {
    return invalidAppMessage(
      `Insufficient collateral for requested asset,
    freeBalance of node: ${nodeFreeBalance.toString()}
    required: ${app.initiatorDeposit}`,
      app,
    );
  }

  if (app.intermediaryIdentifier !== nodeIdentifier) {
    return invalidAppMessage(`Connected node is not in proposed intermediaries`, app);
  }

  return undefined;
}

function invalidAppMessage(prefix: string, app: AppInstanceInfo): string {
  return `${prefix}. Proposed app: ${stringify(app)}`;
}
