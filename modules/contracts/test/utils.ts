import { waffle as buidler } from "@nomiclabs/buidler";
import { toBN } from "@connext/types";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { use } from "chai";
import { BigNumber, BigNumberish } from "ethers/utils";

export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}

// ETH helpers
export const provider = buidler.provider;
export const mineBlock = async () => await provider.send("evm_mine", []);
export const snapshot = async () => await provider.send("evm_snapshot", []);
export const restore = async (snapshotId: any) => await provider.send("evm_revert", [snapshotId]);

// TODO: Not sure this works correctly/reliably...
export const moveToBlock = async (blockNumber: BigNumberish) => {
  const desired: BigNumber = toBN(blockNumber);
  const current: BigNumber = toBN(await provider.getBlockNumber());
  if (current.gt(desired)) {
    throw new Error(`Already at block ${current.toNumber()}, cannot rewind to ${blockNumber.toString()}`);
  }
  if (current.eq(desired)) {
    return;
  }
  for (const _ of Array(desired.sub(current).toNumber())) {
    await mineBlock();
  }
  const final: BigNumber = toBN(await provider.getBlockNumber());
  expect(final).to.be.eq(desired);
};

use(require("chai-subset"));
use(solidity);
export const expect = chai.use(solidity).expect;