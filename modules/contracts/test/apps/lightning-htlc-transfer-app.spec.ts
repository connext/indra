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
    preImage: string;
    turnNum: number;
    finalized: boolean;
};

type LightningHTLCTransferAppAction = {
    preImage: string;
};

const { expect } = chai;

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const lightningHTLCTransferAppStateEncoding = `tuple(
    ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
    bytes32 lockHash,
    bytes32 preImage,
    uint256 turnNum,
    bool finalized
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
  
const decodeAppState = (encodedAppState: string): LightningHTLCTransferAppState =>
    defaultAbiCoder.decode([lightningHTLCTransferAppStateEncoding], encodedAppState)[0];
  
const encodeAppState = (
    state: LightningHTLCTransferAppState,
    onlyCoinTransfers: boolean = false,
): string => {
    if (!onlyCoinTransfers) return defaultAbiCoder.encode([lightningHTLCTransferAppStateEncoding], [state]);
    return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};
  
function encodeAppAction(state: SolidityValueType): string {
    return defaultAbiCoder.encode([linkedTransferAppActionEncoding], [state]);
}

function createLockHash(
    preImage: string,
  ): string {
    return soliditySha256(
      ["bytes32"],
      [preImage],
    );
}

describe("LightningHTLCTransferApp", () => {
    let lightningHTLCTransferApp: Contract;
    let provider = buidler.provider;
  
    async function computeOutcome(state: LightningHTLCTransferAppState): Promise<string> {
      return await lightningHTLCTransferApp.functions.computeOutcome(encodeAppState(state));
    }
  
    async function applyAction(state: any, action: SolidityValueType): Promise<string> {
      return await lightningHTLCTransferApp.functions.applyAction(
        encodeAppState(state),
        encodeAppAction(action),
      );
    }
  
    before(async () => {
      const wallet = (await provider.getWallets())[0];
      lightningHTLCTransferApp = await waffle.deployContract(wallet, LightningHTLCTransferApp);
    });
  
    describe("update state", () => {
      it("can redeem a payment with correct hash", async () => {
        const senderAddr = mkAddress("0xa");
        const receiverAddr = mkAddress("0xB");
        const transferAmount = new BigNumber(10000);
        const preImage = mkHash("0xb");
  
        const lockHash = createLockHash(preImage);
  
        const preState: LightningHTLCTransferAppState = {
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
          turnNum: 0,
          finalized: false
        };
  
        const action: LightningHTLCTransferAppAction = {
          preImage,
        };
  
        let ret = await applyAction(preState, action);
        const afterActionState = decodeAppState(ret);
  
        const postState: LightningHTLCTransferAppState = {
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
          turnNum: 1,
          finalized: true
        };

        expect(afterActionState).eq(postState);
  
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
  