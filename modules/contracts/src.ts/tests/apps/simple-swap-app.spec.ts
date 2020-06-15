import { getRandomAddress } from "@connext/utils";
import { BigNumber, Contract, ContractFactory, utils } from "ethers";

import { SimpleTwoPartySwapApp } from "../../artifacts";

import { expect, provider } from "../utils";

const { defaultAbiCoder } = utils;

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleSwapAppState = {
  coinTransfers: CoinTransfer[][];
};

const multiAssetMultiPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[][]
`;

const swapAppStateEncoding = `tuple(
  ${multiAssetMultiPartyCoinTransferEncoding} coinTransfers
)`;

// FIXME: why does this have to use the multiAsset one?
const decodeAppState = (encodedAppState: string): CoinTransfer[][] =>
  defaultAbiCoder.decode([multiAssetMultiPartyCoinTransferEncoding], encodedAppState)[0];

const encodeAppState = (state: SimpleSwapAppState, onlyCoinTransfers: boolean = false): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([swapAppStateEncoding], [state]);
  return defaultAbiCoder.encode([multiAssetMultiPartyCoinTransferEncoding], [state.coinTransfers]);
};

describe("SimpleTwoPartySwapApp", () => {
  let simpleSwapApp: Contract;

  const computeOutcome = async (state: SimpleSwapAppState): Promise<string> => {
    return simpleSwapApp.computeOutcome(encodeAppState(state));
  };

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    simpleSwapApp = await new ContractFactory(
      SimpleTwoPartySwapApp.abi,
      SimpleTwoPartySwapApp.bytecode,
      wallet,
    ).deploy();
  });

  describe("update state", () => {
    it("can compute outcome with update", async () => {
      const senderAddr = getRandomAddress();
      const receiverAddr = getRandomAddress();
      const tokenAmt = BigNumber.from(10000);
      const ethAmt = BigNumber.from(500);

      const preState: SimpleSwapAppState = {
        coinTransfers: [
          [
            {
              amount: tokenAmt,
              to: senderAddr,
            },
          ],
          [
            {
              amount: ethAmt,
              to: receiverAddr,
            },
          ],
        ],
      };

      const state: SimpleSwapAppState = {
        coinTransfers: [
          [
            {
              amount: ethAmt,
              to: senderAddr,
            },
          ],
          [
            {
              amount: tokenAmt,
              to: receiverAddr,
            },
          ],
        ],
      };

      const ret = await computeOutcome(preState);
      expect(ret).to.eq(encodeAppState(state, true));
      const decoded = decodeAppState(ret);
      expect(decoded[0][0].to).eq(state.coinTransfers[0][0].to);
      expect(decoded[0][0].amount.toString()).eq(state.coinTransfers[0][0].amount.toString());
      expect(decoded[1][0].to).eq(state.coinTransfers[1][0].to);
      expect(decoded[1][0].amount.toString()).eq(state.coinTransfers[1][0].amount.toString());
    });
  });
});
