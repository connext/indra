/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { WithdrawAppState, WithdrawAppAction, CoinTransfer, singleAssetTwoPartyCoinTransferEncoding, WithdrawAppStateEncoding, WithdrawAppActionEncoding } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { BigNumber, defaultAbiCoder, joinSignature, SigningKey } from "ethers/utils";

import WithdrawApp from "../../build/WithdrawApp.json"
import { Zero } from "ethers/constants";

const { expect } = chai;

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedTransfers: string): CoinTransfer<string>[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedTransfers)[0];

const decodeAppState = (encodedAppState: string): WithdrawAppState<string> =>
  defaultAbiCoder.decode([WithdrawAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: WithdrawAppState<string>,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([WithdrawAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.transfers]);
};

const encodeAppAction = (state: WithdrawAppAction): string => {
  return defaultAbiCoder.encode([WithdrawAppActionEncoding], [state]);
}

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
  
  const computeOutcome = async (state: WithdrawAppState<string>): Promise<string> => {
    return await withdrawApp.functions.computeOutcome(encodeAppState(state));
  }
  
  const applyAction = async (state: any, action: WithdrawAppAction): Promise<string> => {
    return await withdrawApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  const createInitialState = (): WithdrawAppState<string> => {
    return {
      transfers: [
        {
          amount: amount.toString(),
          to: withdrawerWallet.address,
        },
        {
          amount: Zero.toString(),
          to: counterpartyWallet.address,
        },
      ],
      signatures: [joinSignature(withdrawerSigningKey.signDigest(data)), mkHash("0x0")],
      signers: [withdrawerWallet.address, counterpartyWallet.address],
      data,
      finalized: false,
    };
  }

  const createAction = (): WithdrawAppAction => {
    return {
      signature: joinSignature(counterpartySigningKey.signDigest(data))
    };
  }

  beforeEach(async () => {
  });

  describe("It zeroes withdrawer balance if state is finalized (w/ valid signatures)", async () => {
    let initialState = createInitialState();
    let action = createAction();

    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    ret = await computeOutcome(afterActionState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(Zero.toString());
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
  })

  describe("It cancels the withdrawal if state is not finalized", async () => {
    let initialState = createInitialState();

    // Compute outcome without taking action
    let ret = await computeOutcome(initialState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(initialState.transfers[0].amount);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero.toString());
  })

  describe("It reverts the action if state is finalized", async () => {
    let initialState = createInitialState();
    let action = createAction();

    let ret = await applyAction(initialState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.signatures[1]).to.eq(action.signature);
    expect(afterActionState.finalized).to.be.true;

    await expect(applyAction(afterActionState, action)).revertedWith("cannot take action on a finalized state")
  })

  describe("It reverts the action if withdrawer signature is invalid", async () => {
    let initialState = createInitialState();
    let action = createAction();

    initialState.signatures[0] = mkHash("0x0");
    await expect(applyAction(initialState, action)).revertedWith("invalid withdrawer signature")
  })

  describe("It reverts the action if counterparty signature is invalid", async () => {
    let initialState = createInitialState();
    let action = createAction();

    action.signature = mkHash("0x0");
    await expect(applyAction(initialState, action)).revertedWith("invalid counterparty signature")
  })
});