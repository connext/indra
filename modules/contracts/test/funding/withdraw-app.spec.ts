import { waffle as buidler } from "@nomiclabs/buidler";
import { signChannelMessage } from "@connext/crypto";

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
import { BigNumber, defaultAbiCoder, SigningKey } from "ethers/utils";

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

const encodeAppState = (state: WithdrawAppState, onlyCoinTransfers: boolean = false): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([WithdrawAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.transfers]);
};

const encodeAppAction = (state: WithdrawAppAction): string => {
  return defaultAbiCoder.encode([WithdrawAppActionEncoding], [state]);
};

describe("WithdrawApp", async () => {
  let provider = buidler.provider;
  const wallet = (await provider.getWallets())[0];
  const withdrawApp: Contract = await waffle.deployContract(wallet, WithdrawApp);
  let withdrawerWallet = Wallet.createRandom();
  let counterpartyWallet = Wallet.createRandom();

  const amount = new BigNumber(10000);
  const data = mkHash("0xa"); // TODO: test this with real withdrawal commitment hash?
  const withdrawerSigningKey = new SigningKey(withdrawerWallet.privateKey);
  const counterpartySigningKey = new SigningKey(counterpartyWallet.privateKey);

  const computeOutcome = async (state: WithdrawAppState): Promise<string> => {
    return await withdrawApp.functions.computeOutcome(encodeAppState(state));
  };

  const applyAction = async (state: any, action: WithdrawAppAction): Promise<string> => {
    return await withdrawApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));
  };

  const createInitialState = async (): Promise<WithdrawAppState> => {
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
      signatures: [await signChannelMessage(withdrawerSigningKey.privateKey, data), HashZero],
      signers: [withdrawerWallet.address, counterpartyWallet.address],
      data,
      finalized: false,
    };
  };

  const createAction = async (): Promise<WithdrawAppAction> => {
    return {
      signature: await signChannelMessage(counterpartySigningKey.privateKey, data),
    };
  };

  beforeEach(async () => {});

  it("It zeroes withdrawer balance if state is finalized (w/ valid signatures)", async () => {
    let initialState = await createInitialState();
    let action = await createAction();

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
    let initialState = await createInitialState();

    // Compute outcome without taking action
    let ret = await computeOutcome(initialState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(initialState.transfers[0].amount);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
  });

  it("It reverts the action if state is finalized", async () => {
    let initialState = await createInitialState();
    let action = await createAction();

    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    await expect(applyAction(afterActionState, action)).revertedWith(
      "cannot take action on a finalized state",
    );
  });

  it("It reverts the action if withdrawer signature is invalid", async () => {
    let initialState = await createInitialState();
    let action = await createAction();

    initialState.signatures[0] = mkHash("0x0");
    await expect(applyAction(initialState, action)).revertedWith("invalid withdrawer signature");
  });

  it("It reverts the action if counterparty signature is invalid", async () => {
    let initialState = await createInitialState();
    let action = await createAction();

    action.signature = HashZero;
    await expect(applyAction(initialState, action)).revertedWith("invalid counterparty signature");
  });
});
