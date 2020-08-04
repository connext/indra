import {
  CoinTransfer,
  GraphBatchedTransferAppAction,
  GraphBatchedTransferAppActionEncoding,
  GraphBatchedTransferAppState,
  GraphBatchedTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  GraphReceipt,
  GRAPH_BATCHED_SWAP_CONVERSION,
} from "@connext/types";
import {
  getTestVerifyingContract,
  getAddressFromPrivateKey,
  getTestGraphReceiptToSign,
  signGraphReceiptMessage,
  keyify,
  signGraphConsumerMessage,
  getRandomBytes32,
} from "@connext/utils";
import { BigNumber, Contract, ContractFactory, constants, utils, Wallet } from "ethers";

import { GraphBatchedTransferApp } from "../../artifacts";

import { expect, provider, mkAddress } from "../utils";

const { Zero } = constants;
const { defaultAbiCoder } = utils;

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): GraphBatchedTransferAppState =>
  defaultAbiCoder.decode([GraphBatchedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: GraphBatchedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([GraphBatchedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: GraphBatchedTransferAppAction): string {
  return defaultAbiCoder.encode([GraphBatchedTransferAppActionEncoding], [state]);
}

describe("GraphBatchedTransferApp", () => {
  let indexerWallet: Wallet;
  let consumerWallet: Wallet;
  let graphBatchedTransferApp: Contract;

  async function computeOutcome(state: GraphBatchedTransferAppState): Promise<CoinTransfer[]> {
    const ret = await graphBatchedTransferApp.computeOutcome(encodeAppState(state));
    return keyify(state.coinTransfers, decodeTransfers(ret));
  }

  async function applyAction(
    state: GraphBatchedTransferAppState,
    action: GraphBatchedTransferAppAction,
  ): Promise<GraphBatchedTransferAppState> {
    const ret = await graphBatchedTransferApp.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
    return keyify(state, decodeAppState(ret));
  }

  async function validateOutcome(outcome: CoinTransfer[], postState: GraphBatchedTransferAppState) {
    expect(outcome[0].to).eq(postState.coinTransfers[0].to);
    expect(outcome[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(outcome[1].to).eq(postState.coinTransfers[1].to);
    expect(outcome[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  async function validateAction(
    preState: GraphBatchedTransferAppState,
    postState: GraphBatchedTransferAppState,
    action: GraphBatchedTransferAppAction,
  ): Promise<void> {
    const calculatedState = {
      ...preState,
      coinTransfers: [
        {
          amount: preState.coinTransfers[0].amount.sub(
            action.totalPaid.mul(preState.swapRate).div(GRAPH_BATCHED_SWAP_CONVERSION),
          ),
          to: preState.coinTransfers[0].to,
        },
        {
          amount: preState.coinTransfers[1].amount.add(
            action.totalPaid.mul(preState.swapRate).div(GRAPH_BATCHED_SWAP_CONVERSION),
          ),
          to: preState.coinTransfers[1].to,
        },
      ],
      chainId: BigNumber.from(preState.chainId),
      finalized: true,
    };
    expect(postState).to.deep.equal(calculatedState);
  }

  async function getInitialState(receipt: GraphReceipt): Promise<GraphBatchedTransferAppState> {
    return {
      coinTransfers: [
        {
          amount: BigNumber.from(10000),
          to: mkAddress("0xa"),
        },
        {
          amount: Zero,
          to: mkAddress("0xB"),
        },
      ],
      attestationSigner: getAddressFromPrivateKey(indexerWallet.privateKey),
      consumerSigner: getAddressFromPrivateKey(consumerWallet.privateKey),
      chainId: (await indexerWallet.provider.getNetwork()).chainId,
      verifyingContract: getTestVerifyingContract(),
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      swapRate: BigNumber.from(1).mul(GRAPH_BATCHED_SWAP_CONVERSION),
      paymentId: getRandomBytes32(),
      finalized: false,
    };
  }

  async function getAction(
    receipt: GraphReceipt,
    totalPaid: BigNumber,
    state0: GraphBatchedTransferAppState,
  ): Promise<GraphBatchedTransferAppAction> {
    const attestationSignature = await signGraphReceiptMessage(
      receipt,
      state0.chainId,
      state0.verifyingContract,
      indexerWallet.privateKey,
    );

    const consumerSignature = await signGraphConsumerMessage(
      receipt,
      state0.chainId,
      state0.verifyingContract,
      totalPaid,
      state0.paymentId,
      consumerWallet.privateKey,
    );

    return {
      totalPaid,
      requestCID: receipt.requestCID,
      responseCID: receipt.responseCID,
      attestationSignature,
      consumerSignature,
    };
  }

  beforeEach(async () => {
    indexerWallet = provider.getWallets()[0];
    consumerWallet = provider.getWallets()[1];
    graphBatchedTransferApp = await new ContractFactory(
      GraphBatchedTransferApp.abi,
      GraphBatchedTransferApp.bytecode,
      indexerWallet,
    ).deploy();
  });

  it("can unlock a batched payment with correct signatures and no swap rate", async () => {
    const receipt = getTestGraphReceiptToSign();
    const totalPaid = BigNumber.from(500);
    const state0 = await getInitialState(receipt);

    const action = await getAction(receipt, totalPaid, state0);
    const state1 = await applyAction(state0, action);
    await validateAction(state0, state1, action);

    const outcome = await computeOutcome(state1);
    await validateOutcome(outcome, state1);
  });

  it("can unlock a batched payment with correct signatures and a swap rate", async () => {
    const receipt = getTestGraphReceiptToSign();
    const totalPaid = BigNumber.from(500);
    const state0 = await getInitialState(receipt);
    state0.swapRate = BigNumber.from(1).mul(GRAPH_BATCHED_SWAP_CONVERSION).div(2); // 0.5

    const action = await getAction(receipt, totalPaid, state0);
    const state1 = await applyAction(state0, action);
    await validateAction(state0, state1, action);

    const outcome = await computeOutcome(state1);
    await validateOutcome(outcome, state1);
  });

  // it("can repeatedly create and unlock payments", async () => {
  //   const iterations = 5;
  //   const receipt = getTestGraphReceiptToSign();
  //   const initialState = await getInitialState(receipt);

  //   let latestState: GraphBatchedTransferAppState;
  //   let prevState = initialState;

  //   for (let i = 0; i < iterations; i++) {
  //     // Create
  //     const createAction = await getCreateAction(receipt);
  //     latestState = await applyAction(prevState, createAction);
  //     await validateAction(prevState, latestState, createAction);
  //     prevState = latestState;

  //     // Unlock
  //     const signature: string = await signGraphReceiptMessage(
  //       receipt,
  //       await wallet.getChainId(),
  //       prevState.verifyingContract,
  //       wallet.privateKey,
  //     );
  //     const unlockAction = await getUnlockAction(receipt, signature);
  //     latestState = await applyAction(prevState, unlockAction);
  //     await validateAction(prevState, latestState, unlockAction);
  //     prevState = latestState;
  //   }

  //   const outcome = await computeOutcome(latestState!);
  //   expect(outcome[0].amount).to.eq(
  //     initialState.coinTransfers[0].amount.sub(BigNumber.from(10).mul(iterations)),
  //   );
  //   expect(outcome[1].amount).to.eq(
  //     initialState.coinTransfers[1].amount.add(BigNumber.from(10).mul(iterations)),
  //   );
  // });

  // it("cannot take action when state is finalized", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);
  //   const finalizedState = {
  //     ...state0,
  //     finalized: true,
  //   };

  //   const action0 = await getCreateAction(receipt);
  //   await expect(applyAction(finalizedState, action0)).revertedWith(
  //     "Cannot take action on finalized state",
  //   );
  // });

  // it("cannot call create with odd turnNum", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);
  //   const oddState = {
  //     ...state0,
  //     turnNum: state0.turnNum + 1,
  //   };

  //   const action0 = await getCreateAction(receipt);
  //   await expect(applyAction(oddState, action0)).revertedWith(
  //     "Transfers can only be created by the app initiator",
  //   );
  // });

  // it("cannot create for more value than you have", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);
  //   const poorState = {
  //     ...state0,
  //     coinTransfers: [
  //       {
  //         ...state0.coinTransfers[0],
  //         amount: BigNumber.from(5),
  //       },
  //       {
  //         ...state0.coinTransfers[1],
  //       },
  //     ],
  //   };

  //   const action0 = await getCreateAction(receipt);
  //   await expect(applyAction(poorState, action0)).revertedWith(
  //     "Cannot create transfer for more value than in balance",
  //   );
  // });

  // it("cannot call unlock with even turnNum", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);

  //   const signature = await signGraphReceiptMessage(
  //       receipt,
  //       state0.chainId,
  //       state0.verifyingContract,
  //       wallet.privateKey,
  //     );
  //   const action0 = await getUnlockAction(receipt, signature);
  //   await expect(applyAction(state0, action0)).revertedWith(
  //     "Transfers can only be unlocked by the app responder",
  //   );
  // });

  // it("cannot call unlock with incorrect signature", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);

  //   const action0 = await getCreateAction(receipt);
  //   const state1 = await applyAction(state0, action0);
  //   await validateAction(state0, state1, action0);

  //   const badSignature = hexZeroPad(hexlify(1), 65);
  //   const action1 = await getUnlockAction(receipt, badSignature);
  //   await expect(applyAction(state1, action1)).revertedWith(
  //     "ECDSA: invalid signature 'v' value",
  //   );
  // });

  // it("does not update balances if cancelled", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);

  //   const action0 = await getCreateAction(receipt);
  //   const state1 = await applyAction(state0, action0);
  //   await validateAction(state0, state1, action0);

  //   const emptySignature = hexZeroPad(hexlify(0), 65);
  //   let action1 = await getUnlockAction(receipt, emptySignature);
  //   action1 = {
  //       ...action1,
  //       responseCID: HashZero,
  //   }
  //   const state2 = await applyAction(state1, action1);
  //   expect(state2).to.deep.eq({
  //       ...state0,
  //       turnNum: BigNumber.from(state0.turnNum + 2),
  //       chainId: BigNumber.from(state0.chainId)
  //   })
  // });

  // it("can finalize on either turntaker", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const state0 = await getInitialState(receipt);
  //   const finalizeAction = await getFinalizeAction()

  //   const finalizeEvens = await applyAction(state0, finalizeAction)
  //   await validateAction(state0, finalizeEvens, finalizeAction)

  //   const action0 = await getCreateAction(receipt);
  //   const state1 = await applyAction(state0, action0);
  //   await validateAction(state0, state1, action0);

  //   const finalizeOdds = await applyAction(state1, finalizeAction)
  //   await validateAction(state1, finalizeOdds, finalizeAction)
  // })

  // it("can get the correct turntaker", async () => {
  //   const receipt = getTestGraphReceiptToSign();
  //   const evenState = await getInitialState(receipt);
  //   const participants = [
  //       mkAddress("0xa"),
  //       mkAddress("0xB")
  //   ]

  //   const turnTakerEven = await graphBatchedTransferApp.getTurnTaker(encodeAppState(evenState), participants);
  //   expect(turnTakerEven).to.be.eq(participants[0])

  //   const oddState = {
  //       ...evenState,
  //       turnNum: evenState.turnNum+1,
  //   }
  //   const turnTakerOdd = await graphBatchedTransferApp.getTurnTaker(encodeAppState(oddState), participants);
  //   expect(turnTakerOdd).to.be.eq(participants[1])

  // })
});
