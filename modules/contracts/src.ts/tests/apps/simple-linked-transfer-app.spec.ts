import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferAppAction,
  SimpleLinkedTransferAppStateEncoding,
  SimpleLinkedTransferAppActionEncoding,
} from "@connext/types";
import { getRandomAddress, getRandomBytes32 } from "@connext/utils";
import { BigNumber, Contract, ContractFactory, constants, utils } from "ethers";

import { SimpleLinkedTransferApp } from "../../artifacts";

import { expect, provider } from "../utils";

const { Zero } = constants;
const { defaultAbiCoder, soliditySha256 } = utils;

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): SimpleLinkedTransferAppState =>
  defaultAbiCoder.decode([SimpleLinkedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: SimpleLinkedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) {
    return defaultAbiCoder.encode([SimpleLinkedTransferAppStateEncoding], [state]);
  }
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

const encodeAppAction = (state: SimpleLinkedTransferAppAction): string => {
  return defaultAbiCoder.encode([SimpleLinkedTransferAppActionEncoding], [state]);
};

const createLinkedHash = (preImage: string): string => {
  return soliditySha256(["bytes32"], [preImage]);
};

describe("SimpleLinkedTransferApp", () => {
  let simpleLinkedTransferApp: Contract;

  const computeOutcome = async (state: SimpleLinkedTransferAppState): Promise<CoinTransfer[]> => {
    const result = await simpleLinkedTransferApp.computeOutcome(encodeAppState(state));
    return decodeTransfers(result);
  };

  const applyAction = async (
    state: SimpleLinkedTransferAppState,
    action: SimpleLinkedTransferAppAction,
  ): Promise<SimpleLinkedTransferAppState> => {
    const result = await simpleLinkedTransferApp.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
    return decodeAppState(result);
  };

  const createInitialState = async (preImage: string): Promise<SimpleLinkedTransferAppState> => {
    const senderAddr = getRandomAddress();
    const receiverAddr = getRandomAddress();
    const transferAmount = BigNumber.from(10000);
    const linkedHash = createLinkedHash(preImage);
    return {
      coinTransfers: [
        {
          amount: transferAmount,
          to: senderAddr,
        },
        {
          amount: Zero,
          to: receiverAddr,
        },
      ],
      linkedHash,
      preImage: getRandomBytes32(),
      finalized: false,
    };
  };

  const validateOutcome = async (
    state: SimpleLinkedTransferAppState,
    outcome: CoinTransfer[],
  ): Promise<void> => {
    expect(outcome[0].to).eq(state.coinTransfers[0].to);
    expect(outcome[0].amount.toString()).eq(state.coinTransfers[0].amount.toString());
    expect(outcome[1].to).eq(state.coinTransfers[1].to);
    expect(outcome[1].amount.toString()).eq(state.coinTransfers[1].amount.toString());
  };

  const validateAction = async (
    pre: SimpleLinkedTransferAppState,
    post: SimpleLinkedTransferAppState,
    action: SimpleLinkedTransferAppAction,
  ) => {
    expect(post.preImage).to.eq(action.preImage);
    expect(post.finalized).to.be.true;
    expect(post.linkedHash).to.eq(pre.linkedHash);
    expect(post.coinTransfers[0].amount).to.eq(Zero);
    expect(post.coinTransfers[0].to).to.eq(pre.coinTransfers[0].to);
    expect(post.coinTransfers[1].amount).to.eq(pre.coinTransfers[0].amount);
    expect(post.coinTransfers[1].to).to.eq(pre.coinTransfers[1].to);
  };

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    simpleLinkedTransferApp = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  it("can redeem a payment with correct hash", async () => {
    const preImage = getRandomBytes32();
    const initialState = await createInitialState(preImage);
    const action: SimpleLinkedTransferAppAction = { preImage };
    const afterActionState = await applyAction(initialState, action);
    await validateAction(initialState, afterActionState, action);
    const outcome = await computeOutcome(afterActionState);
    await validateOutcome(afterActionState, outcome);
  });

  it("refunds a payment if app state is not finalized", async () => {
    const preImage = getRandomBytes32();
    const initialState = await createInitialState(preImage);
    const outcome = await computeOutcome(initialState);
    await validateOutcome(initialState, outcome);
  });

  it("reverts action if state is already finalized", async () => {
    const preImage = getRandomBytes32();
    const initialState = await createInitialState(preImage);
    const action: SimpleLinkedTransferAppAction = { preImage };
    const finalizedState = {
      ...initialState,
      finalized: true,
    };
    await expect(applyAction(finalizedState, action)).revertedWith(
      "Cannot take action on finalized state",
    );
  });

  it("reverts action if incorrect preimage", async () => {
    const preImage = getRandomBytes32();
    const initialState = await createInitialState(preImage);

    // incorrect preimage
    const action: SimpleLinkedTransferAppAction = { preImage: getRandomBytes32() };
    await expect(applyAction(initialState, action)).revertedWith(
      "Hash generated from preimage does not match hash in state",
    );
  });
});
