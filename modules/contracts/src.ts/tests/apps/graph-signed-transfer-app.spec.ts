import {
  CoinTransfer,
  GraphSignedTransferAppAction,
  GraphSignedTransferAppActionEncoding,
  GraphSignedTransferAppState,
  GraphSignedTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  PrivateKey,
  GraphReceipt,
} from "@connext/types";
import {
  getTestVerifyingContract,
  getRandomBytes32,
  getAddressFromPrivateKey,
  getTestGraphReceiptToSign,
  signGraphReceiptMessage,
} from "@connext/utils";
import { BigNumber, Contract, ContractFactory, constants, utils } from "ethers";

import { GraphSignedTransferApp } from "../../artifacts";

import { expect, provider, mkAddress } from "../utils";

const { HashZero, Zero } = constants;
const { defaultAbiCoder } = utils;

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): GraphSignedTransferAppState =>
  defaultAbiCoder.decode([GraphSignedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: GraphSignedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([GraphSignedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: GraphSignedTransferAppAction): string {
  return defaultAbiCoder.encode([GraphSignedTransferAppActionEncoding], [state]);
}

describe("GraphSignedTransferApp", () => {
  let privateKey: PrivateKey;
  let signerAddress: string;
  let chainId: number;
  let verifyingContract: string;
  let receipt: GraphReceipt;
  let goodSig: string;
  let badSig: string;
  let graphSignedTransferApp: Contract;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preState: GraphSignedTransferAppState;
  let paymentId: string;

  async function computeOutcome(state: GraphSignedTransferAppState): Promise<string> {
    return graphSignedTransferApp.computeOutcome(encodeAppState(state));
  }

  async function applyAction(
    state: GraphSignedTransferAppState,
    action: GraphSignedTransferAppAction,
  ): Promise<string> {
    return graphSignedTransferApp.applyAction(encodeAppState(state), encodeAppAction(action));
  }

  async function validateOutcome(encodedTransfers: string, postState: GraphSignedTransferAppState) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  beforeEach(async () => {
    const wallet = provider.getWallets()[0];
    graphSignedTransferApp = await new ContractFactory(
      GraphSignedTransferApp.abi,
      GraphSignedTransferApp.bytecode,
      wallet,
    ).deploy();

    privateKey = wallet.privateKey;
    signerAddress = getAddressFromPrivateKey(privateKey);

    chainId = (await wallet.provider.getNetwork()).chainId;
    receipt = getTestGraphReceiptToSign();
    verifyingContract = getTestVerifyingContract();
    goodSig = await signGraphReceiptMessage(receipt, chainId, verifyingContract, privateKey);
    badSig = getRandomBytes32();
    paymentId = getRandomBytes32();

    senderAddr = mkAddress("0xa");
    receiverAddr = mkAddress("0xB");
    transferAmount = BigNumber.from(10000);
    preState = {
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
      finalized: false,
      paymentId,
      signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
    };
  });

  describe("update state", () => {
    it("will redeem a payment with correct signature", async () => {
      const action: GraphSignedTransferAppAction = {
        ...receipt,
        signature: goodSig,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: GraphSignedTransferAppState = {
        coinTransfers: [
          {
            amount: Zero,
            to: senderAddr,
          },
          {
            amount: transferAmount,
            to: receiverAddr,
          },
        ],
        paymentId,
        signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        finalized: true,
      };

      expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
      expect(afterActionState.coinTransfers[0].amount).to.eq(
        expectedPostState.coinTransfers[0].amount,
      );
      expect(afterActionState.coinTransfers[1].amount).to.eq(
        expectedPostState.coinTransfers[1].amount,
      );

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will cancel a payment if an empty action is given", async () => {
      const action: GraphSignedTransferAppAction = {
        ...receipt,
        responseCID: HashZero,
        signature: goodSig,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: GraphSignedTransferAppState = {
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
        paymentId,
        signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        finalized: true,
      };

      expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
      expect(afterActionState.coinTransfers[0].amount).to.eq(
        expectedPostState.coinTransfers[0].amount,
      );
      expect(afterActionState.coinTransfers[1].amount).to.eq(
        expectedPostState.coinTransfers[1].amount,
      );

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will revert action with incorrect signature", async () => {
      const action: GraphSignedTransferAppAction = {
        ...receipt,
        signature: badSig,
      };

      await expect(applyAction(preState, action)).revertedWith(
        "revert ECDSA: invalid signature length",
      );
    });

    it("will revert action if already finalized", async () => {
      const action: GraphSignedTransferAppAction = {
        ...receipt,
        signature: goodSig,
      };
      preState.finalized = true;

      await expect(applyAction(preState, action)).revertedWith(
        "Cannot take action on finalized state",
      );
    });
  });
});
