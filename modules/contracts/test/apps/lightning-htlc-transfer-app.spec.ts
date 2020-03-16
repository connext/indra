/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import {
  SolidityValueType,
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  HashLockTransferAppState,
  HashLockTransferAppStateEncoding,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppStateBigNumber,
  HashLockTransferAppAction,
} from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { Zero, One } from "ethers/constants";
import { BigNumber, defaultAbiCoder, soliditySha256 } from "ethers/utils";

import LightningHTLCTransferApp from "../../build/HashLockTransferApp.json";

const { expect } = chai;

chai.use(waffle.solidity);

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): HashLockTransferAppStateBigNumber =>
  defaultAbiCoder.decode([HashLockTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: HashLockTransferAppStateBigNumber,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([HashLockTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([HashLockTransferAppActionEncoding], [state]);
}

function createLockHash(preImage: string): string {
  return soliditySha256(["bytes32"], [preImage]);
}

describe("LightningHTLCTransferApp", () => {
  let lightningHTLCTransferApp: Contract;
  let provider = buidler.provider;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preImage: string;
  let lockHash: string;
  let preState: HashLockTransferAppStateBigNumber;

  async function computeOutcome(state: HashLockTransferAppStateBigNumber): Promise<string> {
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
    postState: HashLockTransferAppStateBigNumber,
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
    preImage = mkHash("0xb");
    lockHash = createLockHash(preImage);
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
      preImage: mkHash("0x0"),
      turnNum: Zero,
      finalized: false,
    };
  });

  describe("update state", () => {
    it("will redeem a payment with correct hash", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: HashLockTransferAppStateBigNumber = {
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
        preImage,
        turnNum: One,
        finalized: true,
      };

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will revert a payment with incorrect hash", async () => {
      const action: HashLockTransferAppAction = {
        preImage: mkHash("0xc"), // incorrect hash
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: HashLockTransferAppStateBigNumber = {
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
        preImage: mkHash("0xc"),
        turnNum: One,
        finalized: true,
      };

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will revert a payment that is not finalized", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);
      expect(afterActionState.finalized).to.be.true;

      const modifiedPostState: HashLockTransferAppStateBigNumber = {
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
        preImage: mkHash("0xc"),
        turnNum: One,
        finalized: false,
      };

      ret = await computeOutcome(modifiedPostState);
      validateOutcome(ret, modifiedPostState);
    });

    // TODO how can we test that only the receiver can unlock the payment?
  });
});
