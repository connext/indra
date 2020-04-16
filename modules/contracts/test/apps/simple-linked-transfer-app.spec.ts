/* global before */
import { SolidityValueType } from "@connext/types";
import { Contract, ContractFactory } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256 } from "ethers/utils";

import SimpleLinkedTransferApp from "../../build/SimpleLinkedTransferApp.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: string;
  amount: BigNumber;
  assetId: string;
  paymentId: string;
  preImage: string;
};

type SimpleLinkedTransferAppAction = {
  preImage: string;
};

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const linkedTransferAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 linkedHash,
  uint256 amount,
  address assetId,
  bytes32 paymentId,
  bytes32 preImage
)`;

const linkedTransferAppActionEncoding = `
  tuple(
    bytes32 preImage
  )
`;

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): SimpleLinkedTransferAppState =>
  defaultAbiCoder.decode([linkedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: SimpleLinkedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([linkedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([linkedTransferAppActionEncoding], [state]);
}

function createLinkedHash(
  amount: BigNumber,
  assetId: string,
  paymentId: string,
  preImage: string,
): string {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [amount, assetId, paymentId, preImage],
  );
}

describe("SimpleLinkedTransferApp", () => {
  let simpleLinkedTransferApp: Contract;

  async function computeOutcome(state: SimpleLinkedTransferAppState): Promise<string> {
    return simpleLinkedTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return simpleLinkedTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    simpleLinkedTransferApp = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  describe("update state", () => {
    it("can redeem a payment with correct hash", async () => {
      const senderAddr = mkAddress("0xa");
      const receiverAddr = mkAddress("0xB");
      const transferAmount = new BigNumber(10000);
      const paymentId = mkHash("0xa");
      const preImage = mkHash("0xb");
      const assetId = AddressZero;

      const linkedHash = createLinkedHash(transferAmount, assetId, paymentId, preImage);

      const preState: SimpleLinkedTransferAppState = {
        amount: transferAmount,
        assetId,
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
        paymentId,
        preImage: mkHash("0x0"),
      };

      const action: SimpleLinkedTransferAppAction = {
        preImage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);
      expect(afterActionState.preImage).eq(preImage);

      const postState: SimpleLinkedTransferAppState = {
        amount: transferAmount,
        assetId,
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
        linkedHash,
        paymentId,
        preImage,
      };

      ret = await computeOutcome(afterActionState);
      const decoded = decodeTransfers(ret);

      expect(ret).to.eq(encodeAppState(postState, true));
      expect(decoded[0].to).eq(postState.coinTransfers[0].to);
      expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
      expect(decoded[1].to).eq(postState.coinTransfers[1].to);
      expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
    });
  });
});
