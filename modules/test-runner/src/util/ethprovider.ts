import { JsonRpcProvider } from "ethers/providers";

import { env } from "./env";

export const ethProvider = new JsonRpcProvider(env.ethProviderUrl);

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
