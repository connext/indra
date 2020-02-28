/* global before */
import { waffle as buidler } from "@nomiclabs/buidler";
import { SolidityValueType } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256 } from "ethers/utils";

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