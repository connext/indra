/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256, soliditySha256 } from "ethers/utils";

import LightningHTLCTransferApp from "../../build/LightningHTLCTransferApp.json";

chai.use(waffle.solidity);

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type LightningHTLCTransferAppState = {
  coinTransfers: CoinTransfer[];
  lockHash: string;
  preimage: string;
  turnNum: number;
  finalized: boolean;
};

type LightningHTLCTransferAppAction = {
  preimage: string;
};

const { expect } = chai;

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const lightningHTLCTransferAppStateEncoding = `tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 lockHash,
    bytes32 preimage,
    uint256 turnNum,
    bool finalized
)`;

const linkedTransferAppActionEncoding = `
  tuple(
    bytes32 preimage
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

const decodeAppState = (encodedAppState: string): LightningHTLCTransferAppState =>
  defaultAbiCoder.decode([lightningHTLCTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: LightningHTLCTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([lightningHTLCTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([linkedTransferAppActionEncoding], [state]);
}

function createLockHash(preimage: string): string {
  return soliditySha256(["bytes32"], [preimage]);
}

describe("LightningHTLCTransferApp", () => {
  let lightningHTLCTransferApp: Contract;
  let provider = buidler.provider;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preimage: string;
  let lockHash: string;
  let preState: LightningHTLCTransferAppState;

  async function computeOutcome(state: LightningHTLCTransferAppState): Promise<string> {
    return await lightningHTLCTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await lightningHTLCTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function validateOutcome(
    encodedTransfers: string,
    postState: LightningHTLCTransferAppState,
  ) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    lightningHTLCTransferApp = await waffle.deployContract(wallet, LightningHTLCTransferApp);

    senderAddr = mkAddress("0xa");
    receiverAddr = mkAddress("0xB");
    transferAmount = new BigNumber(10000);
    preimage = mkHash("0xb");
    lockHash = createLockHash(preimage);
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
      lockHash,
      preimage: mkHash("0x0"),
      turnNum: 0,
      finalized: false,
    };
  });

  describe("update state", () => {
    it("will redeem a payment with correct hash", async () => {
      const action: LightningHTLCTransferAppAction = {
        preimage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: LightningHTLCTransferAppState = {
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
        lockHash,
        preimage,
        turnNum: 1,
        finalized: true,
      };

      expect(afterActionState).eq(expectedPostState);

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, afterActionState);
    });

    it("will revert a payment with incorrect hash", async () => {
      const action: LightningHTLCTransferAppAction = {
        preimage: mkHash("0xc"), // incorrect hash
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: LightningHTLCTransferAppState = {
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
        lockHash,
        preimage: mkHash("0xc"),
        turnNum: 1,
        finalized: true,
      };

      expect(afterActionState).eq(expectedPostState);

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, afterActionState);
    });

    it("will revert a payment that is not finalized", async () => {
      const action: LightningHTLCTransferAppAction = {
        preimage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);
      expect(afterActionState.finalized).to.be.true;

      const modifiedPostState: LightningHTLCTransferAppState = {
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
        lockHash,
        preimage: mkHash("0xc"),
        turnNum: 1,
        finalized: false,
      };

      ret = await computeOutcome(modifiedPostState);
      validateOutcome(ret, modifiedPostState);
    });

    // TODO how can we test that only the receiver can unlock the payment?
  });
});
