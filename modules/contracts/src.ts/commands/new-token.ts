import { Wallet, utils } from "ethers";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { cliOpts } from "../constants";
import { isContractDeployed, deployContract } from "../deploy";
import { getProvider } from "../utils";

const newToken = async (wallet: Wallet, addressBookPath: string, force: boolean) => {
  const chainId = (await wallet.provider.getNetwork()).chainId;
  const addressBook = getAddressBook(addressBookPath, chainId.toString());
  const savedAddress = addressBook.getEntry("Token").address;
  if (force || !(await isContractDeployed("Token", savedAddress, addressBook, wallet.provider))) {
    console.log(`Preparing to deploy new token to chain w id: ${chainId}\n`);
    const token = await deployContract("Token", [], wallet, addressBook);
    console.log(`Success!`);
    const initalSupply = await token.INITIAL_SUPPLY();
    console.log(`Minted ${utils.formatEther(initalSupply)} tokens & gave them all to ${wallet.address}`);
  } else {
    console.log(`Token is up to date, no action required`);
    console.log(`Address: ${savedAddress}`);
  }
};

export const newTokenCommand = {
  command: "new-token",
  describe: "Deploy a new ERC20 token contract",
  builder: (yargs: Argv) => {
    return yargs
      .option("a", cliOpts.addressBook)
      .option("m", cliOpts.mnemonic)
      .option("p", cliOpts.ethProvider)
      .option("f", cliOpts.force);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await newToken(
      Wallet.fromMnemonic(argv.mnemonic).connect(getProvider(argv.ethProvider)),
      argv.addressBook,
      argv.force,
    );
  },
};
