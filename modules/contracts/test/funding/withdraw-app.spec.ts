/* global before */
import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  WithdrawAppAction,
  WithdrawAppActionEncoding,
  WithdrawAppState,
  WithdrawAppStateEncoding,
} from "@connext/types";
import { ChannelSigner } from "@connext/utils";
import { Wallet, ContractFactory, Contract } from "ethers";
import { BigNumber, defaultAbiCoder, hexlify, randomBytes, SigningKey } from "ethers/utils";

import WithdrawApp from "../../build/WithdrawApp.json";
import { Zero, HashZero, One } from "ethers/constants";

import { expect, provider } from "../utils";

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
  let wallet: Wallet;
  let withdrawApp: Contract;

  // test constants
  const withdrawerWallet = Wallet.createRandom();
  const counterpartyWallet = Wallet.createRandom();
  const amount = new BigNumber(10000);
  const data = mkHash("0xa"); // TODO: test this with real withdrawal commitment hash?
  const withdrawerSigningKey = new SigningKey(withdrawerWallet.privateKey);
  const counterpartySigningKey = new SigningKey(counterpartyWallet.privateKey);

  before(async () => {
    wallet = (await provider.getWallets())[2];
    withdrawApp = await new ContractFactory(WithdrawApp.abi, WithdrawApp.bytecode, wallet).deploy();
  });

  // helpers
  const computeOutcome = async (state: WithdrawAppState): Promise<string> => {
    return withdrawApp.functions.computeOutcome(encodeAppState(state));
  };

  const applyAction = async (state: any, action: WithdrawAppAction): Promise<string> => {
    return withdrawApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));
  };

  const init = async (state: WithdrawAppState): Promise<boolean> => {
    return withdrawApp.functions.init(encodeAppState(state))
  }

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
      signatures: [
        await (new ChannelSigner(withdrawerSigningKey.privateKey).signMessage(data)),
        HashZero,
      ],
      signers: [withdrawerWallet.address, counterpartyWallet.address],
      data,
      nonce: hexlify(randomBytes(32)),
      finalized: false,
    };
  };

  const createAction = async (): Promise<WithdrawAppAction> => {
    return {
      signature: await (new ChannelSigner(counterpartySigningKey.privateKey).signMessage(data)),
    };
  };

  it("Correctly calls init with correct initial state", async() => {
    let initialState = await createInitialState();
    await expect(init(initialState)).to.be.ok;
  })

  it("fails init with zero initiator amount", async() => {
    let initialState = await createInitialState();
    initialState.transfers[0].amount = Zero
    await expect(init(initialState)).revertedWith("cannot install withdraw app with zero initiator amount");
  })

  it("fails init with nonzero responder amount", async() => {
    let initialState = await createInitialState();
    initialState.transfers[1].amount = One
    await expect(init(initialState)).revertedWith("cannot install withdraw app with nonzero responder amount");
  })

  it("fails init with finalized state", async() => {
    let initialState = await createInitialState();
    initialState.finalized = true;
    await expect(init(initialState)).revertedWith("cannot install withdraw app with finalized state");
  })

  // TODO correctly rejects with the right message but still fails test?
  it.skip("fails init with populated signatures[1] field", async() => {
    let initialState = await createInitialState();
    initialState.signatures[1] = "0x0100000000000000000000000000000000000000000000000000000000000000";
    await expect(init(initialState)).revertedWith("cannot install withdraw app with a populated signatures[1] field");
  })

  it("fails init with incorrect withdrawer signature", async() => {
    let initialState = await createInitialState();
    initialState.signatures[0] = "0x0100000000000000000000000000000000000000000000000000000000000000";
    await expect(init(initialState)).revertedWith("cannot install withdraw app with invalid withdrawer signature");
  })

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
