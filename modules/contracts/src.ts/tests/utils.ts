import { waffle as buidler } from "@nomiclabs/buidler";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { use } from "chai";

use(require("chai-subset"));
use(solidity);

export const expect = chai.use(solidity).expect;

export const provider = buidler.provider;

export const mineBlocks = async (n: number = 1) => {
  for (let i = 0; i < n; i++) {
    await provider.send("evm_mine", []);
  };
};

export const snapshot = async () => await provider.send("evm_snapshot", []);

export const restore = async (snapshotId: any) => await provider.send("evm_revert", [snapshotId]);
