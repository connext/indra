import { Wallet } from "ethers";
import { parseEther } from "ethers/utils";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { cliOpts } from "../constants";
import { deployContract } from "../deploy";
import { getProvider } from "../utils";

const newToken = async (
  wallet: Wallet,
  addressBookPath: string,
) => {
  const chainId = (await wallet.provider.getNetwork()).chainId;
  const addressBook = getAddressBook(addressBookPath, chainId.toString());
  console.log(`Preparing to deploy new token to chain w id: ${chainId}\n`);
  const token = await deployContract("Token", [], wallet, addressBook);
  console.log(`Success!`);
  const initalSupply = "10000000";
  await token.mint(wallet.address, parseEther(initalSupply));
  console.log(`Minted ${initalSupply} tokens & gave them all to ${wallet.address}`);
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
      Wallet.fromMnemonic(argv.mnemonic).connect(getProvider(argv.ethProvider)),
      argv.addressBook,
    );
  },
};
