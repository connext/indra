import { Wallet } from "ethers";
import { EtherSymbol } from "ethers/constants";
import { formatEther } from "ethers/utils";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { cliOpts } from "../constants";
import { deployContract } from "../deploy";
import { getProvider } from "../utils";

const coreContracts = [
  "ChallengeRegistry",
  "ConditionalTransactionDelegateTarget",
  "DepositApp",
  "HashLockTransferApp",
  "IdentityApp",
  "MinimumViableMultisig",
  "MultiAssetMultiPartyCoinTransferInterpreter",
  "ProxyFactory",
  "SimpleLinkedTransferApp",
  "SimpleSignedTransferApp",
  "SimpleTransferApp",
  "SimpleTwoPartySwapApp",
  "SingleAssetTwoPartyCoinTransferInterpreter",
  "TimeLockedPassThrough",
  "TwoPartyFixedOutcomeInterpreter",
  "WithdrawApp",
];

export const migrate = async (wallet: Wallet, addressBookPath: string): Promise<void> => {

  ////////////////////////////////////////
  // Environment Setup

  const balance = await wallet.getBalance();
  const chainId = (await wallet.provider.getNetwork()).chainId;
  const nonce = await wallet.getTransactionCount();

  console.log(`\nPreparing to migrate contracts to chain w id: ${chainId}`);
  console.log(`Deployer Wallet: address=${wallet.address} nonce=${nonce} balance=${formatEther(balance)}`);

  const addressBook = getAddressBook(addressBookPath, chainId.toString());

  ////////////////////////////////////////
  // Deploy contracts

  for (const name of coreContracts) {
    await deployContract(name, [], wallet, addressBook);
  }

  ////////////////////////////////////////
  // Print summary

  console.log("\nAll done!");
  const spent = formatEther(balance.sub(await wallet.getBalance()));
  const nTx = (await wallet.getTransactionCount()) - nonce;
  console.log(`Sent ${nTx} transaction${nTx === 1 ? "" : "s"} & spent ${EtherSymbol} ${spent}`);
};

export const migrateCommand = {
  command: "migrate",
  describe: "Migrate contracts",
  builder: (yargs: Argv) => {
    return yargs
      .option("a", cliOpts.addressBook)
      .option("m", cliOpts.mnemonic)
      .option("p", cliOpts.ethProvider);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await migrate(
      Wallet.fromMnemonic(argv.mnemonic).connect(getProvider(argv.ethProvider)),
      argv.addressBook,
    );
  },
};
