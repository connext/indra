import { Wallet } from "ethers";
import { EtherSymbol } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { formatEther } from "ethers/utils";
import { Argv } from "yargs";

import { getAddressBook } from "../address-book";
import { classicProviders, defaults } from "../constants";
import * as artifacts from "../artifacts";
import { deployContract } from "../utils";

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
  const chainId = (await wallet.provider.getNetwork()).chainId; // saved to global scope
  const nonce = await wallet.getTransactionCount();

  console.log(`\nPreparing to migrate contracts to chain w id: ${chainId}`);
  console.log(`Deployer Wallet: address=${wallet.address} nonce=${nonce} balance=${formatEther(balance)}`);

  const addressBook = getAddressBook(addressBookPath, chainId.toString());

  ////////////////////////////////////////
  // Deploy contracts

  for (const name of coreContracts) {
    await deployContract(name, artifacts[name], [], wallet, addressBook);
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
      .option("mnemonic", {
        description: "The mnemonic for an account which will pay gas costs",
        type: "string",
        default: defaults.mnemonic,
      })
      .option("eth-provider", {
        description: "The URL of a provider for the target Ethereum network",
        type: "string",
        default: defaults.providerUrl,
      })
      .option("address-book", {
        description: "The path to your address-book.json file",
        type: "string",
        default: defaults.addressBookPath,
      });
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await migrate(
      Wallet.fromMnemonic(argv.mnemonic).connect(
        new JsonRpcProvider(
          argv.ethProvider,
          classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
        ),
      ),
      argv.addressBook,
    );
  },
};
