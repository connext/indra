import { RegisteredAppDetails, SupportedApplication } from "@connext/types";
import { AppInstanceInfo } from "@counterfactual/types";
import { utils } from "ethers";
import { AddressZero } from "ethers/constants";

import { freeBalanceAddressFromXpub } from "..//lib/utils";
import { ConnextInternal } from "../connext";

const MIN_TIMEOUT = utils.bigNumberify(60000);

type ProposalValidator = {
  [index in SupportedApplication]: (
    app: AppInstanceInfo,
    registeredInfo: RegisteredAppDetails,
    connext: ConnextInternal,
  ) => Promise<string | undefined>;
};

// TODO: implement
export const validateSwapApp = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  connext: ConnextInternal,
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // validate the exchange rate is within expected
  // TODO: whats the best way to validate the exchange rate
  // here? how will it get stored in the connext object when
  // input into the controller?

  // This is called as a default to the propose app install event
  // which may not have context into what *your* exchange rate is?

  return undefined;
};

// TODO: implement
export const validateTransferApp = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  connext: ConnextInternal,
  // TODO: ideally this wouldnt get passed in, but you need it
  // to check things like your public identifier, open apps,
  // free balance, etc.
): Promise<string | undefined> => {
  const baseValidation = await baseAppValidation(app, registeredInfo, connext);
  if (baseValidation) {
    return baseValidation;
  }

  // check that the receivers deposit is 0
  // FIXME: how to check for the receiver?
  if (!app.peerDeposit.isZero() && !app.myDeposit.isZero()) {
    return `There must be at least one zero deposit in the application. Proposed app: ${prettyLog(
      app,
    )}`;
  }

  // TODO: ordering restrictions (i.e who has to propose it)

  return undefined;
};

export const appProposalValidation: ProposalValidator = {
  EthUnidirectionalTransferApp: validateTransferApp,
  SimpleTwoPartySwapApp: validateSwapApp,
};

const prettyLog = (app: AppInstanceInfo) => {
  // convert any field thats a BN to a string
  const asStr = {};
  Object.entries(app).forEach(([name, value]) => {
    asStr[name] = value.toString();
  });
  return JSON.stringify(asStr, null, 2);
};

const baseAppValidation = async (
  app: AppInstanceInfo,
  registeredInfo: RegisteredAppDetails,
  connext: ConnextInternal,
): Promise<string | undefined> => {
  // check timeout above minimum (TODO: remove?)
  if (app.timeout.lte(MIN_TIMEOUT)) {
    return `Timeout too short. Proposed app: ${prettyLog(app)}`;
  }

  // check that identity hash isnt used by another app
  const sharedId = (await connext.getAppInstances()).filter(
    (a: AppInstanceInfo) => a.identityHash === app.identityHash,
  );
  if (sharedId.length !== 0) {
    return `Duplicate app id detected. Proposed app: ${prettyLog(app)}`;
  }

  // check that the app definition is the same
  if (app.appDefinition !== registeredInfo.appDefinitionAddress) {
    return `Incorrect app definition detected. Proposed app: ${prettyLog(app)}`;
  }

  // check that the encoding is the same
  if (app.abiEncodings.actionEncoding !== registeredInfo.actionEncoding) {
    return `Incorrect action encoding detected. Proposed app: ${prettyLog(app)}`;
  }

  if (app.abiEncodings.stateEncoding !== registeredInfo.stateEncoding) {
    return `Incorrect state encoding detected. Proposed app: ${prettyLog(app)}`;
  }

  // check that the outcome type is the same
  // TODO: what checks needed for the interpreter params?
  if (app.peerDeposit.isZero() && app.myDeposit.isZero()) {
    return `Refusing to install app with two zero value deposits. Proposed app: ${prettyLog(app)}`;
  }

  // check that there is enough in the free balance of desired currency
  // to install app
  // FIXME: how to get assetId
  const assetId = AddressZero;
  const ethFreeBalance = await connext.getFreeBalance(assetId);
  if (ethFreeBalance[freeBalanceAddressFromXpub(connext.publicIdentifier)].lt(app.myDeposit)) {
    return `Insufficient free balance for requested asset. Proposed app: ${prettyLog(app)}`;
  }

  // check that the intermediary includes your node
  const node = app.intermediaries.filter((intermediary: string) => {
    return intermediary === connext.nodePublicIdentifier;
  });
  if (node.length !== 1) {
    return `Connected node is not in proposed intermediaries. Proposed app: ${prettyLog(app)}`;
  }

  return undefined;
};
