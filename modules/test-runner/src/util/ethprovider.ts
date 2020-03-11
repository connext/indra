import { Contract, Wallet } from "ethers";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber, BigNumberish } from "ethers/utils";
import abi from "human-standard-token-abi";

import { env } from "./env";

export const ethProvider = new JsonRpcProvider(env.ethProviderUrl);
export const ethWallet = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);

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
  if (assetId === AddressZero) {
    await ethWallet.sendTransaction({ to, value });
  } else {
    const tokenContract = new Contract(assetId, abi, ethWallet);
    await tokenContract.functions.transfer(to, value);
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
