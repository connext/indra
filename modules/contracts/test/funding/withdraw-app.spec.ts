/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import WithdrawApp from "../../build/WithdrawApp.json"
import { Zero } from "ethers/constants";

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

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
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
  let withdrawerWallet = Wallet.createRandom();
  let counterpartyWallet = Wallet.createRandom();
  let initialState: WithdrawAppState;
  let action: WithdrawAction;

  async function computeOutcome(state: WithdrawAppState): Promise<string> {
    return await withdrawApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await withdrawApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    withdrawApp = await waffle.deployContract(wallet, WithdrawApp);
    const withdrawerAddress = withdrawerWallet.address;
    const counterpartyAddress = counterpartyWallet.address;
    const amount = new BigNumber(10000);
    const data = mkHash("0xb"); // TODO: test this with real withdrawal commitment

    initialState = {
      coinTransfers: [
        {
          amount,
          to: withdrawerAddress,
        },
        {
          amount: Zero,
          to: counterpartyAddress,
        },
      ],
      signatures: [await withdrawerWallet.signMessage(data), ""],
      signers: [withdrawerAddress, counterpartyAddress],
      data,
      finalized: false,
    };

    action = {
      signature: await counterpartyWallet.signMessage(data)
    };
  });

  describe("It zeroes withdrawer balance if state is finalized (w/ valid signatures)", async () => {
    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    ret = await computeOutcome(afterActionState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.coinTransfers[0].to);
    expect(decoded[0].amount).eq(Zero);
    expect(decoded[1].to).eq(initialState.coinTransfers[1].to);
    expect(decoded[1].amount).eq(Zero);
  })

  // describe("It cancels the withdrawal if state is not finalized", async () => {
  //   // Compute outcome without taking action
  //   let ret = await computeOutcome(initialState);
  //   const decoded = decodeTransfers(ret);

  //   expect(decoded[0].to).eq(initialState.coinTransfers[0].to);
  //   expect(decoded[0].amount).eq(initialState.coinTransfers[0].amount);
  //   expect(decoded[1].to).eq(initialState.coinTransfers[1].to);
  //   expect(decoded[1].amount).eq(Zero);
  // })

  // describe("It reverts the action if state is finalized", async () => {
  //   let ret = await applyAction(initialState, action);
  //   const afterActionState = decodeAppState(ret);
  //   expect(afterActionState.signatures[1]).to.eq(action.signature);
  //   expect(afterActionState.finalized).to.be.true;

  //   await expect(applyAction(afterActionState, action)).rejectedWith("cannot take action on a finalized state")
  // })

  // describe("It reverts the action if withdrawer signature is invalid", async () => {
  //   initialState.signatures[0] = "";
  //   await expect(applyAction(initialState, action)).rejectedWith("invalid withdrawer signature")
  // })

  // describe("It reverts the action if counterparty signature is invalid", async () => {
  //   action.signature = "";
  //   await expect(applyAction(initialState, action)).rejectedWith("invalid counterparty signature")
  // })

});