import { Address, AppInstanceJson } from "@connext/types";
import { BigNumber, constants } from "ethers";

import { Node } from "../node";

import { TestContractAddresses } from "./contracts";
import { getAppInstance, getApps, installApp, takeAppAction, uninstallApp } from "./utils";

const { Zero } = constants;

type UnidirectionalLinkedTransferAppAction = {
  amount: BigNumber;
  assetId: Address;
  paymentId: string;
  preImage: string;
};

type UnidirectionalLinkedTransferAppState = {
  linkedHash: string;
  stage: number; // POST_FUND = 0;
  finalized: boolean;
  turnNum: BigNumber;
  transfers: CoinTransfer[];
};

type CoinTransfer = {
  to: Address;
  amount: BigNumber;
};

const { UnidirectionalLinkedTransferApp } = global["contracts"] as TestContractAddresses;

export async function installLink(
  funder: Node,
  redeemer: Node,
  multisigAddress: string,
  state: UnidirectionalLinkedTransferAppState,
  action: UnidirectionalLinkedTransferAppAction,
): Promise<string> {
  const linkDef = UnidirectionalLinkedTransferApp;

  const res = await installApp(
    funder,
    redeemer,
    multisigAddress,
    linkDef,
    state,
    BigNumber.from(action.amount),
    action.assetId,
    Zero,
    action.assetId,
  );
  return res[0]; // appIdentityHash
}

function assertLinkRedemption(app: AppInstanceJson, amount: BigNumber): void {
  expect((app.latestState as UnidirectionalLinkedTransferAppState).finalized).toEqual(true);
  expect((app.latestState as UnidirectionalLinkedTransferAppState).transfers[1][1]).toBeEq(amount);
  expect((app.latestState as UnidirectionalLinkedTransferAppState).transfers[0][1]).toBeEq(Zero);
}

/**
 * Takes an action on an already installed link app to redeem the locked value
 * and uninstalls the app
 */
export async function redeemLink(
  redeemer: Node,
  funder: Node,
  appIdentityHash: string,
  multisigAddress: string,
  action: UnidirectionalLinkedTransferAppAction,
): Promise<string> {
  // take action to finalize state and claim funds from intermediary
  await takeAppAction(redeemer, appIdentityHash, multisigAddress, action);
  const redeemerApp = await getAppInstance(redeemer, appIdentityHash);
  assertLinkRedemption(redeemerApp, action.amount);
  return uninstallApp(redeemer, funder, appIdentityHash, multisigAddress);
}

/**
 * Completes the "redeem flow":
 * 1. Matching app with intermediary and link funder found
 * 2. Redeemer and intermediary install a link app
 * 3. Redeemer takes action on the app to claim funds
 * 4. Intermediary takes action on matched app to reclaim funds
 */
export async function installAndRedeemLink(
  funder: Node,
  intermediary: Node,
  redeemer: Node,
  multisigAddressFunderIntermediary: string,
  multisigAddressIntermediaryRedeemer: string,
  stateAndAction: { action: any; state: any },
) {
  const linkDef = UnidirectionalLinkedTransferApp;

  const hubApps = await getApps(intermediary, multisigAddressFunderIntermediary);

  const { state, action } = stateAndAction;

  const hasAddressInTransfers = (app: AppInstanceJson, addr: string): boolean => {
    return (
      (app.latestState as UnidirectionalLinkedTransferAppState).transfers[0].to === addr ||
      (app.latestState as UnidirectionalLinkedTransferAppState).transfers[1].to === addr
    );
  };

  const getMatchingHubApp = (apps: AppInstanceJson[]) => {
    return apps.find(
      (app) =>
        app.appInterface.addr === linkDef &&
        hasAddressInTransfers(app, funder.signerAddress) &&
        (app.latestState as UnidirectionalLinkedTransferAppState).linkedHash === state.linkedHash,
    );
  };

  const matchedApp = getMatchingHubApp(hubApps);
  expect(matchedApp).toBeDefined();

  // install an app between the intermediary and redeemer
  const redeemerAppId = await installLink(
    intermediary,
    redeemer,
    multisigAddressIntermediaryRedeemer,
    state,
    action,
  );

  // redeemer take action to finalize state and claim funds from intermediary
  await redeemLink(
    redeemer,
    intermediary,
    redeemerAppId,
    multisigAddressIntermediaryRedeemer,
    action,
  );

  // intermediary takes action to finalize state and claim funds from creator
  await redeemLink(
    intermediary,
    funder,
    matchedApp!.identityHash,
    multisigAddressFunderIntermediary,
    action,
  );
}
