/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { BigNumber, defaultAbiCoder, solidityKeccak256, recoverAddress } from "ethers/utils";

import { WithdrawApp } from "../../build/WithdrawApp.json"

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type WithdrawAppState = {
  coinTransfers: CoinTransfer[];
  signatures: string[];
  signers: string[];
  data: string;
  finalized: boolean;
};

type WithdrawAction = {
  signature: string;
}

const { expect } = chai;

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const WithdrawAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 signatures[2],
  address signers[2],
  bytes32 data,
  bool finalized
)`;

const WithdrawAppActionEncoding = `
  tuple(
    bytes32 signature
  )
`;

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): WithdrawAppState =>
  defaultAbiCoder.decode([WithdrawAppStateEncoding], encodedAppState)[0];

  const encodeAppState = (
    state: WithdrawAppState,
    onlyCoinTransfers: boolean = false,
  ): string => {
    if (!onlyCoinTransfers) return defaultAbiCoder.encode([WithdrawAppStateEncoding], [state]);
    return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
  };
  
  function encodeAppAction(state: SolidityValueType): string {
    return defaultAbiCoder.encode([WithdrawAppActionEncoding], [state]);
  }

describe("WithdrawApp", () => {
  let withdrawApp: Contract;
  let provider = buidler.provider;

  async function computeOutcome(state: WithdrawAppState): Promise<string> {
    return await WithdrawApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await WithdrawApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    withdrawApp = await waffle.deployContract(wallet, WithdrawApp);
  });

});