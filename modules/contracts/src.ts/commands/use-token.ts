import { JsonRpcProvider } from "ethers/providers";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { cliOpts } from "../constants";
import { getProvider } from "../utils";

const useToken = async (
  ethProvider: JsonRpcProvider,
  addressBookPath: string,
  tokenAddress: string,
) => {
  const chainId = (await ethProvider.getNetwork()).chainId;
  const addressBook = getAddressBook(addressBookPath, chainId.toString());
  addressBook.setEntry("Token", { address: tokenAddress });
};

export const useTokenCommand = {
  command: "new-token",
  describe: "Deploy a new ERC20 token contract",
  builder: (yargs: Argv) => {
    return yargs
      .option("a", cliOpts.addressBook)
      .option("p", cliOpts.ethProvider);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await useToken(
      getProvider(argv.ethProvider),
      argv.addressBook,
      argv.tokenAddress,
    );
  },
};

