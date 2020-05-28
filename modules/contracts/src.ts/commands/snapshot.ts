import { Argv } from "yargs";
import { JsonRpcProvider } from "ethers/providers";

import { classicProviders, ganacheId } from "../constants";

export const snapshot = async (ethProvider: JsonRpcProvider): Promise<void> => {
  const chainId = (await ethProvider.getNetwork()).chainId; // saved to global scope
  if (chainId === ganacheId) {
    const snapshotId = await ethProvider.send("evm_snapshot", []);
    console.log(`Took an EVM snapshot, id: ${snapshotId}`);
  }
};

export const snapshotCommand = {
  command: "snapshot",
  describe: "Take a snapshot of the current EVM state (testnet only)",
  builder: (yargs: Argv) => {
    return yargs
      .option("eth-provider", {
        description: "The URL of a provider for the target Ethereum network",
        type: "string",
      })
      .demandOption(["eth-provider"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await snapshot(
      new JsonRpcProvider(
        argv.ethProvider,
        classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
      ),
    );
  },
};
