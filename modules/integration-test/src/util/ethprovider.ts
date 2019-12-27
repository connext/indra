import { Contract } from "ethers";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";

export const ethProvider = new JsonRpcProvider(process.env.INDRA_ETH_RPC_URL);

const abi = [
  "function balanceOf(address owner) view returns (uint)",
  "function transfer(address to, uint amount)",
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

/**
 * EVM snapshot, returns hex string of snapshot ID.
 */
export const takeEVMSnapshot = async (): Promise<string> => {
  const res = await ethProvider.send("evm_snapshot", []);
  console.log(`evm_snapshot, res: ${res}`);
  return res;
};

export const revertEVMSnapshot = async (snapshotId: string): Promise<void> => {
  const res = await ethProvider.send("evm_revert", [snapshotId]);
  if (res !== true) {
    throw new Error(`evm_revert failed, res: ${res}`);
  }
  console.log(`evm_revert, res: ${res}`);
};

export const getOnchainBalance = async (address: string, assetId: string): Promise<string> => {
  let result: string;
  if (assetId === AddressZero) {
    try {
      result = (await ethProvider.getBalance(address)).toString();
    } catch (e) {
      throw new Error(`Error getting Eth balance for ${address}: ${e}`);
    }
  } else {
    try {
      const tokenContract = new Contract(assetId, abi, ethProvider);
      result = (await tokenContract.functions.balanceOf(address)).toString();
    } catch (e) {
      throw new Error(`Error getting token balance for ${address}: ${e}`);
    }
  }
  return result;
};
