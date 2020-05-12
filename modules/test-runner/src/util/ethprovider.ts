import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber, BigNumberish, parseEther } from "ethers/utils";
import abi from "human-standard-token-abi";

import { env } from "./env";
import { stringify } from "@connext/utils";
import { ERC20, addressBook } from "@connext/contracts";

export const ethProvider = new JsonRpcProvider(env.ethProviderUrl);
export const sugarDaddy = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);
export const ethWallet = Wallet.createRandom().connect(ethProvider);

export const fundEthWallet = async () => {
  const FUND_AMT = parseEther("10000");
  const tokenContract = new Contract(addressBook[4447].Token.address, ERC20.abi, sugarDaddy);
  const ethFunding = await sugarDaddy.sendTransaction({
    to: ethWallet.address,
    value: FUND_AMT,
  });
  await ethFunding.wait();
  const tx = await tokenContract.functions.transfer(ethWallet.address, FUND_AMT);
  await tx.wait();
  return;
};

/**
 * EVM snapshot, returns hex string of snapshot ID.
 */
export const takeEVMSnapshot = async (): Promise<string> => {
  const res = await ethProvider.send("evm_snapshot", []);
  return res;
};

export const revertEVMSnapshot = async (snapshotId: string): Promise<void> => {
  const res = await ethProvider.send("evm_revert", [snapshotId]);
  if (res !== true) {
    throw new Error(`evm_revert failed, res: ${res}`);
  }
};

export const sendOnchainValue = async (
  to: string,
  value: BigNumberish,
  assetId: string = AddressZero,
): Promise<void> => {
  const nonceErr = "the tx doesn't have the correct nonce";
  const retries = 3;
  for (let i = 0; i < retries; i++) {
    const nonce = await ethWallet.getTransactionCount();
    try {
      if (assetId === AddressZero) {
        const tx = await ethWallet.sendTransaction({
          to,
          value,
          nonce,
        });
        await tx.wait();
        return;
      } else {
        const tokenContract = new Contract(assetId, abi, ethWallet);
        const tx = await tokenContract.functions.transfer(to, value, { nonce });
        await tx.wait();
        return;
      }
    } catch (e) {
      console.log("***** caught error!", stringify(e), e.message);
      if (e.message.includes(nonceErr)) {
        continue;
      }
      throw e;
    }
  }
};

export const getOnchainBalance = async (
  address: string,
  assetId: string = AddressZero,
): Promise<BigNumber> => {
  let result: BigNumber;
  if (assetId === AddressZero) {
    try {
      result = await ethProvider.getBalance(address);
    } catch (e) {
      throw new Error(`Error getting Eth balance for ${address}: ${e.toString()}`);
    }
  } else {
    try {
      const tokenContract = new Contract(assetId, abi, ethProvider);
      result = await tokenContract.functions.balanceOf(address);
    } catch (e) {
      throw new Error(`Error getting token balance for ${address}: ${e.toString()}`);
    }
  }
  return result;
};
