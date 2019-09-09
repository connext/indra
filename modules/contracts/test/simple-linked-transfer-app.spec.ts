import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256 } from "ethers/utils";

import SimpleLinkedTransferApp from "../build/SimpleLinkedTransferApp.json";

chai.use(waffle.solidity);

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: string;
  amount: BigNumber;
  paymentId: string;
  preImage: string;
};

const { expect } = chai;

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const linkedTransferAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 linkedHash,
  uint256 amount,
  bytes32 paymentId,
  bytes32 preImage
)`;

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

// FIXME: why does this have to use the multiAsset one?
const decodeAppState = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const encodeAppState = (
  state: SimpleLinkedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([linkedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function createLinkedHash(amount: BigNumber, paymentId: string, preImage: string): string {
  return solidityKeccak256(["uint256", "bytes32", "bytes32"], [amount, paymentId, preImage]);
}

describe("SimpleLinkedTransferApp", () => {
  let simpleLinkedTransferApp: Contract;

  async function computeOutcome(state: SimpleLinkedTransferAppState): Promise<string> {
    return await simpleLinkedTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  before(async () => {
    const provider = waffle.createMockProvider();
    const wallet = (await waffle.getWallets(provider))[0];
    simpleLinkedTransferApp = await waffle.deployContract(wallet, SimpleLinkedTransferApp);
  });

  describe("update state", () => {
    it("can redeem a payment with correct hash", async () => {
      const senderAddr = mkAddress("0xa");
      const receiverAddr = mkAddress("0xB");
      const transferAmount = new BigNumber(10000);
      const paymentId = mkHash("0xa");
      const preImage = mkHash("0xb");

      const linkedHash = createLinkedHash(transferAmount, paymentId, preImage);

      const preState: SimpleLinkedTransferAppState = {
        amount: transferAmount,
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
        preImage,
      };

      const postState: SimpleLinkedTransferAppState = {
        amount: transferAmount,
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

      const ret = await computeOutcome(preState);
      const decoded = decodeAppState(ret);

      expect(ret).to.eq(encodeAppState(postState, true));
      expect(decoded[0].to).eq(postState.coinTransfers[0].to);
      expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
      expect(decoded[1].to).eq(postState.coinTransfers[1].to);
      expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
    });
  });
});
