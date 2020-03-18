/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  WithdrawAppAction,
  WithdrawAppActionEncoding,
  WithdrawAppState,
  WithdrawAppStateEncoding,
} from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { BigNumber, defaultAbiCoder, joinSignature, SigningKey } from "ethers/utils";

import WithdrawApp from "../../build/WithdrawApp.json";
import { Zero, HashZero } from "ethers/constants";

const { expect } = chai;

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedTransfers: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedTransfers)[0];

const decodeAppState = (encodedAppState: string): WithdrawAppState =>
  defaultAbiCoder.decode([WithdrawAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: WithdrawAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([WithdrawAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.transfers]);
};

const encodeAppAction = (state: WithdrawAppAction): string => {
  return defaultAbiCoder.encode([WithdrawAppActionEncoding], [state]);
};

describe("WithdrawApp", async () => {
  let provider = buidler.provider;
  let wallet: Wallet;
  let withdrawerWallet: Wallet;
  let counterpartyWallet: Wallet;
  let withdrawApp: Contract;
  let withdrawerSigningKey: SigningKey;
  let counterpartySigningKey: SigningKey;

  const amount = new BigNumber(10000);
  const data = mkHash("0xa"); // TODO: test this with real withdrawal commitment hash?

  before(async () => {
    provider = buidler.provider;
    wallet = (await provider.getWallets())[0];
    withdrawApp = await waffle.deployContract(wallet, WithdrawApp);
    withdrawerWallet = Wallet.createRandom();
    counterpartyWallet = Wallet.createRandom();
    withdrawerSigningKey = new SigningKey(withdrawerWallet.privateKey);
    counterpartySigningKey = new SigningKey(counterpartyWallet.privateKey);
  });
  
  const computeOutcome = async (state: WithdrawAppState): Promise<string> => {
    return await withdrawApp.functions.computeOutcome(encodeAppState(state));
  };

  const applyAction = async (state: any, action: WithdrawAppAction): Promise<string> => {
    return await withdrawApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  };

  const createInitialState = (): WithdrawAppState => {
    return {
      transfers: [
        {
          amount,
          to: withdrawerWallet.address,
        },
        {
          amount: Zero,
          to: counterpartyWallet.address,
        },
      ],
      signatures: [joinSignature(withdrawerSigningKey.signDigest(data)), HashZero],
      signers: [withdrawerWallet.address, counterpartyWallet.address],
      data,
      finalized: false,
    };
  };

  const createAction = (): WithdrawAppAction => {
    return {
      signature: joinSignature(counterpartySigningKey.signDigest(data)),
    };
  };

  it("It zeroes withdrawer balance if state is finalized (w/ valid signatures)", async () => {
    let initialState = createInitialState();
    let action = createAction();

    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    ret = await computeOutcome(afterActionState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(Zero);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
  });

  it("It cancels the withdrawal if state is not finalized", async () => {
    let initialState = createInitialState();

    // Compute outcome without taking action
    let ret = await computeOutcome(initialState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(initialState.transfers[0].amount);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
  });

  it("It reverts the action if state is finalized", async () => {
    let initialState = createInitialState();
    let action = createAction();

    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    await expect(applyAction(afterActionState, action)).revertedWith("cannot take action on a finalized state");
  });

  it("It reverts the action if withdrawer signature is invalid", async () => {
    let initialState = createInitialState();
    let action = createAction();

    initialState.signatures[0] = mkHash("0x0");
    await expect(applyAction(initialState, action)).revertedWith("invalid withdrawer signature");
  });

  it("It reverts the action if counterparty signature is invalid", async () => {
    let initialState = createInitialState();
    let action = createAction();

    action.signature = HashZero;
    await expect(applyAction(initialState, action)).revertedWith("invalid counterparty signature");
  });
});
