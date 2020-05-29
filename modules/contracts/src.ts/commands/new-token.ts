import { Wallet } from "ethers";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { cliOpts } from "../constants";
import { deployContract } from "../deploy";
import { getProvider } from "../utils";

const newToken = async (
  wallet: Wallet,
  addressBookPath: string,
  name: string,
  symbol: string,
  decimals: string,
) => {
  const chainId = (await wallet.provider.getNetwork()).chainId;
  const addressBook = getAddressBook(addressBookPath, chainId.toString());
  console.log(`\nPreparing to deploy new token to chain w id: ${chainId}`);
  const tokenAddress = await deployContract(
    "Token", [
      { name: "name", value: "TestToken" },
      { name: "symbol", value: "TEST" },
    ],
    wallet,
    addressBook,
  );
  console.log(`Success! New token deployed to address ${tokenAddress}`);
};

export const newTokenCommand = {
  command: "new-token",
  describe: "Deploy a new ERC20 token contract",
  builder: (yargs: Argv) => {
    return yargs
      .option("a", cliOpts.addressBook)
      .option("m", cliOpts.mnemonic)
      .option("p", cliOpts.ethProvider);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await newToken(
      Wallet.fromMnemonic(argv.fromMnemonic).connect(getProvider(argv.ethProvider)),
      argv.addressBook,
      argv.tokenName,
      argv.tokenSymbol,
      argv.tokenDecimals,
    );
  },
};
