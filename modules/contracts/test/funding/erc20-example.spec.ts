/* global before */
import { Contract, Wallet, ContractFactory, BigNumber } from "ethers";

import DolphinCoin from "../../build/DolphinCoin.json";

import { expect, provider } from "../utils";

const DOLPHINCOIN_SUPPLY = BigNumber.from(10).pow(18).mul(10000);

describe("DolphinCoin (ERC20) can be created", () => {
  let wallet: Wallet;
  let erc20: Contract;

  before(async () => {
    wallet = provider.getWallets()[0];
    erc20 = await new ContractFactory(DolphinCoin.abi, DolphinCoin.bytecode, wallet).deploy();
  });

  describe("Deployer has all of initial supply", () => {
    it("Initial supply for deployer is DOLPHINCOIN_SUPPLY", async () => {
      expect(await erc20.balanceOf(wallet.address)).to.be.eq(DOLPHINCOIN_SUPPLY);
    });
  });
});
