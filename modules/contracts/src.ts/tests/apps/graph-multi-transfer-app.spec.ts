import {
  CoinTransfer,
  GraphMultiTransferAppAction,
  GraphMultiTransferAppActionEncoding,
  GraphMultiTransferAppState,
  GraphMultiTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  GraphReceipt,
  GraphActionType,
} from "@connext/types";
import {
  getTestVerifyingContract,
  getAddressFromPrivateKey,
  getTestGraphReceiptToSign,
  signGraphReceiptMessage,
  keyify,
} from "@connext/utils";
import { BigNumber, Contract, ContractFactory, constants, utils, Wallet } from "ethers";

import { GraphMultiTransferApp } from "../../artifacts";

import { expect, provider, mkAddress } from "../utils";
import { hexZeroPad, hexlify } from "ethers/lib/utils";

const { HashZero, Zero, One } = constants;
const { defaultAbiCoder } = utils;

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): GraphMultiTransferAppState =>
  defaultAbiCoder.decode([GraphMultiTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: GraphMultiTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([GraphMultiTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: GraphMultiTransferAppAction): string {
  return defaultAbiCoder.encode([GraphMultiTransferAppActionEncoding], [state]);
}

describe("GraphMultiTransferApp", () => {
  let wallet: Wallet;
  let graphMultiTransferApp: Contract;

  async function computeOutcome(state: GraphMultiTransferAppState): Promise<CoinTransfer[]> {
    let ret = await graphMultiTransferApp.computeOutcome(encodeAppState(state));
    return keyify(state.coinTransfers, decodeTransfers(ret));
  }

  async function applyAction(
    state: GraphMultiTransferAppState,
    action: GraphMultiTransferAppAction,
  ): Promise<GraphMultiTransferAppState> {
    let ret = await graphMultiTransferApp.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
    return keyify(state, decodeAppState(ret));
  }

  async function validateOutcome(outcome: CoinTransfer[], postState: GraphMultiTransferAppState) {
    expect(outcome[0].to).eq(postState.coinTransfers[0].to);
    expect(outcome[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(outcome[1].to).eq(postState.coinTransfers[1].to);
    expect(outcome[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  async function validateAction(
    preState: GraphMultiTransferAppState,
    postState: GraphMultiTransferAppState,
    action: GraphMultiTransferAppAction,
  ): Promise<void> {
    switch (action.actionType) {
      case GraphActionType.CREATE: {
        expect(postState).to.deep.eq({
          ...preState,
          lockedPayment: {
            requestCID: action.requestCID,
            price: action.price,
          },
          chainId: BigNumber.from(preState.chainId),
          turnNum: BigNumber.from(preState.turnNum).add(One),
        });
        break;
      }
      case GraphActionType.UNLOCK: {
        expect(postState).to.deep.eq({
          ...preState,
          lockedPayment: {
            requestCID: HashZero,
            price: Zero,
          },
          coinTransfers: [
            {
              ...preState.coinTransfers[0],
              amount: preState.coinTransfers[0].amount.sub(preState.lockedPayment.price),
            },
            {
              ...preState.coinTransfers[1],
              amount: preState.coinTransfers[1].amount.add(preState.lockedPayment.price),
            },
          ],
          turnNum: BigNumber.from(preState.turnNum).add(One),
        });
        break;
      }
      case GraphActionType.FINALIZE: {
        expect(postState).to.deep.eq({
          ...preState,
          finalized: true,
          turnNum: BigNumber.from(preState.turnNum).add(One),
        });
        break;
      }
      default:
        throw new Error(`Unrecognized action type: ${action.actionType}`);
    }
  }

  async function getInitialState(receipt: GraphReceipt): Promise<GraphMultiTransferAppState> {
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
      signerAddress: getAddressFromPrivateKey(wallet.privateKey),
      chainId: (await wallet.provider.getNetwork()).chainId,
      verifyingContract: getTestVerifyingContract(),
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      lockedPayment: {
        requestCID: HashZero,
        price: Zero,
      },
      turnNum: 0,
      finalized: false,
    };
  }

  async function getCreateAction(receipt: GraphReceipt): Promise<GraphMultiTransferAppAction> {
    return {
      actionType: GraphActionType.CREATE,
      requestCID: receipt.requestCID,
      price: BigNumber.from(10),
      responseCID: HashZero,
      signature: hexZeroPad(hexlify(0), 65),
    };
  }

  async function getUnlockAction(
    receipt: GraphReceipt,
    signature: string,
  ): Promise<GraphMultiTransferAppAction> {
    return {
      actionType: GraphActionType.UNLOCK,
      requestCID: HashZero,
      price: Zero,
      responseCID: receipt.responseCID,
      signature,
    };
  }

  async function getFinalizeAction(): Promise<GraphMultiTransferAppAction> {
    return {
      actionType: GraphActionType.FINALIZE,
      requestCID: HashZero,
      price: Zero,
      responseCID: HashZero,
      signature: hexZeroPad(hexlify(0), 65),
    };
  }

  beforeEach(async () => {
    wallet = provider.getWallets()[0];
    graphMultiTransferApp = await new ContractFactory(
      GraphMultiTransferApp.abi,
      GraphMultiTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  it("sender creates transfer, receiver unlocks, sender finalizes, computesOutcome", async () => {
    const receipt = getTestGraphReceiptToSign();
    const state0 = await getInitialState(receipt);

    const action0 = await getCreateAction(receipt);
    const state1 = await applyAction(state0, action0);
    await validateAction(state0, state1, action0);

    const signature = await signGraphReceiptMessage(
      receipt,
      state0.chainId,
      state0.verifyingContract,
      wallet.privateKey,
    );
    const action1 = await getUnlockAction(receipt, signature);
    const state2 = await applyAction(state1, action1);
    await validateAction(state1, state2, action1);

    const action2 = await getFinalizeAction();
    const state3 = await applyAction(state2, action2);
    await validateAction(state2, state3, action2);

    const outcome = await computeOutcome(state3);
    await validateOutcome(outcome, state3);
  });

  it("can repeatedly create and unlock payments", async () => {
    const iterations = 5;
    const receipt = getTestGraphReceiptToSign();
    const initialState = await getInitialState(receipt);

    let latestState: GraphMultiTransferAppState;
    let prevState = initialState;

    for (let i = 0; i < iterations; i++) {
      // Create
      const createAction = await getCreateAction(receipt);
      latestState = await applyAction(prevState, createAction);
      await validateAction(prevState, latestState, createAction);
      prevState = latestState;

      // Unlock
      const signature: string = await signGraphReceiptMessage(
        receipt,
        await wallet.getChainId(),
        prevState.verifyingContract,
        wallet.privateKey,
      );
      const unlockAction = await getUnlockAction(receipt, signature);
      latestState = await applyAction(prevState, unlockAction);
      await validateAction(prevState, latestState, unlockAction);
      prevState = latestState;
    }

    const outcome = await computeOutcome(latestState!);
    expect(outcome[0].amount).to.eq(
      initialState.coinTransfers[0].amount.sub(BigNumber.from(10).mul(iterations)),
    );
    expect(outcome[1].amount).to.eq(
      initialState.coinTransfers[1].amount.add(BigNumber.from(10).mul(iterations)),
    );
  });

  /*
        Test cases:
        - Cannot take action when state is finalized
        - Create:
            - Cannot call with odd turnNum
            - Cannot create for more value than you have
        - Unlock:
            - Cannot call with even turnNum
            - Fails if incorrect signature
            - Does not update balances if cancelled
        - Finalize:
            - Can finalize on evens
            - Can finalize on odds
        - Can get the correct turntaker
    */
});
