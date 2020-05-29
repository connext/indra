import * as tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { Contract, ContractFactory, Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { Argv } from "yargs";
import { classicProviders, ganacheId } from "../constants";

const newToken = async (wallet: Wallet, name: string, symbol: string, decimals: string) => {
};

export const newTokenCommand = {
  command: "new-token",
  describe: "Deploy a new ERC20 token contract",
  builder: (yargs: Argv) => {
    return yargs
      .option("eth-provider", {
        description: "The URL of a provider for the target Ethereum network",
        type: "string",
      })
      .option("mnemonic", {
        description: "The mnemonic for an account which will pay gas costs",
        type: "string",
      })
      .option("token-name", {
        description: "The name of the new token",
        type: "string",
        default: "TestToken",
      })
      .option("token-symbol", {
        description: "The symbol of the new token",
        type: "string",
        default: "TEST",
      })
      .option("token-decimals", {
        description: "The number of decimals supported by the new token",
        type: "string",
        default: "18",
      })
      .demandOption(["eth-provider", "mnemonic", "to-address"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await newToken(
      Wallet.fromMnemonic(argv.fromMnemonic).connect(
        new JsonRpcProvider(
          argv.ethProvider,
          classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
        ),
      ),
      argv.tokenName,
      argv.tokenSymbol,
      argv.tokenDecimals,
    );
  },
};
