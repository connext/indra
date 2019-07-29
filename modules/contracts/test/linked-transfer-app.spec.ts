import { SolidityABIEncoderV2Type } from "@counterfactual/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import UnidirectionalLinkedTransferApp from "../build/contracts/UnidirectionalLinkedTransferApp.json";

chai.use(waffle.solidity);

const { expect } = chai;

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type LinkedTransferAppState = {
  transfers: CoinTransfer[];
  finalized: boolean;
  preImage: string;
};

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
};

// TODO: fix all the below actions and functions
function decodeBytesToAppState(encodedAppState: string): LinkedTransferAppState {
  return defaultAbiCoder.decode(
    [`tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)`],
    encodedAppState,
  )[0];
}

function encodeState(state: SolidityABIEncoderV2Type) {
  return defaultAbiCoder.encode(
    [`tuple(tuple(address to, uint256 amount)[] transfers, bool finalized)`],
    [state],
  );
}

function encodeAction(state: SolidityABIEncoderV2Type) {
  return defaultAbiCoder.encode([`tuple(uint256 transferAmount, bool finalize)`], [state]);
}

// async function applyAction(state: SolidityABIEncoderV2Type, action: SolidityABIEncoderV2Type) {
//   return await coinTransferApp.functions.applyAction(encodeState(state), encodeAction(action));
// }

// async function computeOutcome(state: SolidityABIEncoderV2Type) {
//   return await coinTransferApp.functions.computeOutcome(encodeState(state));
// }

describe("LinkedUnidirectionalTransferApp", () => {})